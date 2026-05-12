import { classifySpan, extractAgentInstanceId, extractAgentName } from '#/lib/classify-span'
import { propagateSessionInTrace, type Span, type SpanKind } from '#/lib/spans'
import type {
  GetTraceOpts,
  ListTracesOpts,
  SessionFetch,
  SessionSummary,
  TelemetryProvider,
  TraceSummary,
} from './types'

export interface OpenObserveConfig {
  baseUrl: string
  org: string
  stream: string
  user: string
  password: string
}

const DEFAULT_SIZE = 1000
const DEFAULT_LIST_LIMIT = 50
// Per-row cap on the session-aggregation scan. Sessions are reconstructed
// in TS from raw spans, so we have to pull every span that could carry
// session-identifying info. If the scan hits this cap, `listSessions`
// reports `truncated: true` so the UI can warn the user.
const SESSION_SCAN_LIMIT = 10000
// Last 30 days — OO scans local Parquet, cost ~free.
const DEFAULT_WINDOW_US = 30 * 24 * 60 * 60 * 1_000_000

export function createOpenObserveProvider(cfg: OpenObserveConfig): TelemetryProvider {
  const search = async (sql: string, fromUs: number, toUs: number, size = DEFAULT_SIZE) => {
    const body = JSON.stringify({
      query: { sql, start_time: fromUs, end_time: toUs, from: 0, size },
    })
    const auth = btoa(`${cfg.user}:${cfg.password}`)
    const resp = await fetch(`${cfg.baseUrl}/api/${cfg.org}/_search?type=traces`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    if (!resp.ok) {
      throw new Error(`OpenObserve ${resp.status}: ${await resp.text()}`)
    }
    return (await resp.json()) as { hits?: unknown[] }
  }

  return {
    name: 'openobserve',
    fingerprint: `${cfg.baseUrl}/${cfg.org}`,

    async getTrace(traceId, opts) {
      const { fromUs, toUs } = window(opts)
      const sql = `SELECT * FROM "${cfg.stream}" WHERE trace_id='${traceId}'`
      const data = await search(sql, fromUs, toUs)
      const hits = (data.hits ?? []) as Array<Record<string, unknown>>
      if (hits.length === 0) return { kind: 'not_found' }
      const spans = hits.map(normalizeOpenObserveHit)
      propagateSessionInTrace(spans)
      const truncated = hits.length >= DEFAULT_SIZE
      return { kind: 'found', spans, truncated }
    },

    async listSessions(opts) {
      const { fromUs, toUs } = window(opts)
      const limit = opts?.limit ?? DEFAULT_LIST_LIMIT
      // Pull every row needed to (a) resolve a trace's session id and (b)
      // roll up its tokens/cost. Group by trace in TS, then by session.
      const sql = `
        SELECT
          trace_id,
          span_id,
          reference_parent_span_id,
          operation_name,
          ag_ui_thread_id,
          start_time,
          end_time,
          gen_ai_operation_name,
          llm_usage_tokens_total,
          llm_usage_cost_total,
          span_status
        FROM "${cfg.stream}"
        WHERE operation_name LIKE 'invoke_agent %'
           OR gen_ai_operation_name = 'chat'
           OR ag_ui_thread_id IS NOT NULL
        ORDER BY start_time DESC
        LIMIT ${SESSION_SCAN_LIMIT}
      `
      const data = await search(sql, fromUs, toUs, SESSION_SCAN_LIMIT)
      const hits = (data.hits ?? []) as Array<Record<string, unknown>>
      const truncated = hits.length >= SESSION_SCAN_LIMIT
      return { sessions: aggregateSessions(hits, limit), truncated }
    },

    async getSession(sessionId, opts): Promise<SessionFetch> {
      // Hex / alphanumeric / underscore / hyphen only — protects against SQL
      // injection in the interpolated WHERE below. Any legitimate session id
      // (UUID, hash, agent-instance hex, user-supplied slug) matches.
      if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) return { kind: 'not_found' }
      // `_` is a single-char LIKE wildcard. Escape with `!` (kept simple to
      // avoid the JS↔SQL backslash double-escape mess) for the agent-instance
      // LIKE branch. The thread-id branch uses `=`, no escaping needed.
      const escapedForLike = sessionId.replace(/[!_%]/g, '!$&')
      const { fromUs, toUs } = window(opts)
      // Step 1: find every trace whose spans belong to this session.
      const traceIdSql = `
        SELECT DISTINCT trace_id
        FROM "${cfg.stream}"
        WHERE ag_ui_thread_id = '${sessionId}'
           OR operation_name LIKE 'invoke_agent %(${escapedForLike})%' ESCAPE '!'
      `
      const trData = await search(traceIdSql, fromUs, toUs)
      const trHits = (trData.hits ?? []) as Array<Record<string, unknown>>
      const traceIds = trHits.map((h) => String(h.trace_id)).filter(Boolean)
      if (traceIds.length === 0) return { kind: 'not_found' }
      // Step 2: bulk-fetch all spans for those traces.
      const idList = traceIds.map((id) => `'${id}'`).join(',')
      const spansSql = `SELECT * FROM "${cfg.stream}" WHERE trace_id IN (${idList})`
      const spansData = await search(spansSql, fromUs, toUs)
      const spanHits = (spansData.hits ?? []) as Array<Record<string, unknown>>
      const spans = spanHits.map(normalizeOpenObserveHit)
      // Propagate sessionId within each trace independently — different traces
      // in the same session each have their own root invoke_agent.
      const byTrace = new Map<string, Span[]>()
      for (const s of spans) {
        const arr = byTrace.get(s.traceId) ?? []
        arr.push(s)
        byTrace.set(s.traceId, arr)
      }
      for (const trSpans of byTrace.values()) propagateSessionInTrace(trSpans)
      const source: 'attribute' | 'agent-instance' = spans.some((s) => s.sessionSource === 'attribute')
        ? 'attribute'
        : 'agent-instance'
      return { kind: 'found', sessionId, source, traceIds, spans }
    },

    async listTraces(opts) {
      const { fromUs, toUs } = window(opts)
      const limit = opts?.limit ?? DEFAULT_LIST_LIMIT
      // Aggregate by trace_id. Tokens / cost from chat spans only — agent
      // spans roll up the same numbers, so summing all spans would double-count.
      const sql = `
        SELECT
          trace_id,
          MIN(start_time) AS first_seen,
          MAX(end_time)   AS last_seen,
          COUNT(*)        AS span_count,
          SUM(CASE WHEN gen_ai_operation_name = 'chat' THEN llm_usage_tokens_total ELSE 0 END) AS total_tokens,
          SUM(CASE WHEN gen_ai_operation_name = 'chat' THEN llm_usage_cost_total   ELSE 0 END) AS total_cost,
          MAX(CASE WHEN operation_name LIKE 'invoke_agent %' THEN operation_name END) AS sample_agent,
          MAX(CASE WHEN span_status = 'ERROR' THEN 1 ELSE 0 END) AS has_error,
          MAX(ag_ui_thread_id) AS session_id,
          MAX(service_name)    AS service_name
        FROM "${cfg.stream}"
        WHERE gen_ai_operation_name IS NOT NULL
        GROUP BY trace_id
        ORDER BY first_seen DESC
        LIMIT ${limit}
      `
      const data = await search(sql, fromUs, toUs, limit)
      const hits = (data.hits ?? []) as Array<Record<string, unknown>>
      return hits.map(hitToSummary)
    },
  }
}

function window(opts: GetTraceOpts | ListTracesOpts | undefined): { fromUs: number; toUs: number } {
  const toUs = opts?.toUs ?? Date.now() * 1000
  const fromUs = opts?.fromUs ?? toUs - DEFAULT_WINDOW_US
  return { fromUs, toUs }
}

function hitToSummary(h: Record<string, unknown>): TraceSummary {
  const firstSeenNs = Number(h.first_seen ?? 0)
  const lastSeenNs = Number(h.last_seen ?? 0)
  const summary: TraceSummary = {
    id: String(h.trace_id),
    startedAtMs: Math.floor(firstSeenNs / 1_000_000),
    durationMs: Math.max(0, Math.floor((lastSeenNs - firstSeenNs) / 1_000_000)),
    spanCount: Number(h.span_count ?? 0),
    hasError: Number(h.has_error ?? 0) === 1,
  }
  const tokens = num(h.total_tokens)
  if (tokens) summary.totalTokens = tokens
  const cost = num(h.total_cost)
  if (cost) summary.totalCostUsd = cost
  const agent = extractAgentName(String(h.sample_agent ?? ''))
  if (agent) summary.agent = agent
  const session = h.session_id
  if (typeof session === 'string' && session) summary.sessionId = session
  const service = h.service_name
  if (typeof service === 'string' && service) summary.serviceName = service
  return summary
}

// OpenObserve flattens span attributes into top-level row fields (underscore
// form: `gen_ai_request_model`, `llm_usage_tokens_total`, ...). classifySpan
// reads whatever Record we hand it, so we pass the whole hit.
function normalizeOpenObserveHit(h: Record<string, unknown>): Span {
  const operationName = String(h.operation_name ?? '?')
  return {
    id: String(h.span_id),
    traceId: String(h.trace_id ?? ''),
    parentId: (h.reference_parent_span_id as string) || null,
    service: String(h.service_name ?? 'unknown'),
    kind: kindFromNumber(h.span_kind),
    name: operationName,
    // OpenObserve stores start_time/end_time in nanoseconds, duration in microseconds.
    // We normalize to ms throughout the app.
    startMs: Math.floor(Number(h.start_time ?? 0) / 1_000_000),
    endMs: Math.floor(Number(h.end_time ?? 0) / 1_000_000),
    ...classifySpan(operationName, h),
  }
}

// Roll rows up into SessionSummary[]. Two-stage: per-trace first (resolve
// session id, sum tokens/cost), then per-session.
//
// Per-trace session id priority:
//   1. Real `ag_ui_thread_id` attribute on any span → source = 'attribute'
//   2. Hex of the OUTERMOST `invoke_agent` span (the one whose parent isn't
//      another invoke_agent) → source = 'agent-instance'
// Sub-agents (Explorer nested inside ProverbsAgent) carry their own hex but
// must NOT constitute a session — picking the outermost agent ensures
// the trace gets bucketed under the orchestrator's session.
function aggregateSessions(hits: Array<Record<string, unknown>>, limit: number): SessionSummary[] {
  // Group rows by trace_id.
  const rowsByTrace = new Map<string, Array<Record<string, unknown>>>()
  for (const h of hits) {
    const traceId = String(h.trace_id ?? '')
    if (!traceId) continue
    const arr = rowsByTrace.get(traceId) ?? []
    arr.push(h)
    rowsByTrace.set(traceId, arr)
  }

  type TraceSession = {
    traceId: string
    sessionId: string
    source: 'attribute' | 'agent-instance'
    startMs: number
    endMs: number
    agents: Set<string>
    tokens: number
    cost: number
    hasError: boolean
  }
  const tracesBySession = new Map<string, TraceSession[]>()
  for (const [traceId, rows] of rowsByTrace) {
    const ts = resolveTraceSession(traceId, rows)
    if (!ts) continue
    const arr = tracesBySession.get(ts.sessionId) ?? []
    arr.push(ts)
    tracesBySession.set(ts.sessionId, arr)
  }

  const out: SessionSummary[] = []
  for (const [sessionId, traces] of tracesBySession) {
    // Attribute-source wins if any trace in the session has it.
    const source: 'attribute' | 'agent-instance' = traces.some((t) => t.source === 'attribute')
      ? 'attribute'
      : 'agent-instance'
    const s: SessionSummary = {
      sessionId,
      source,
      startedAtMs: Math.min(...traces.map((t) => t.startMs)),
      lastSeenMs: Math.max(...traces.map((t) => t.endMs)),
      traceCount: traces.length,
      agents: [...new Set(traces.flatMap((t) => [...t.agents]))],
    }
    const totalTokens = traces.reduce((acc, t) => acc + t.tokens, 0)
    if (totalTokens > 0) s.totalTokens = totalTokens
    const totalCost = traces.reduce((acc, t) => acc + t.cost, 0)
    if (totalCost > 0) s.totalCostUsd = totalCost
    if (traces.some((t) => t.hasError)) s.hasError = true
    out.push(s)
  }

  out.sort((a, b) => b.lastSeenMs - a.lastSeenMs)
  return out.slice(0, limit)
}

// Resolve session info for one trace's rows. Returns undefined if neither
// the attribute path nor the heuristic produces a session id.
function resolveTraceSession(
  traceId: string,
  rows: Array<Record<string, unknown>>,
):
  | {
      traceId: string
      sessionId: string
      source: 'attribute' | 'agent-instance'
      startMs: number
      endMs: number
      agents: Set<string>
      tokens: number
      cost: number
      hasError: boolean
    }
  | undefined {
  // 1) Attribute source: any span carrying `ag_ui_thread_id`.
  let sessionId: string | undefined
  let source: 'attribute' | 'agent-instance' | undefined
  for (const h of rows) {
    if (typeof h.ag_ui_thread_id === 'string' && h.ag_ui_thread_id) {
      sessionId = h.ag_ui_thread_id
      source = 'attribute'
      break
    }
  }

  // 2) Heuristic: hex of the OUTERMOST invoke_agent (parent not in this
  //    trace's set of invoke_agent span_ids → it's the orchestrator).
  if (!sessionId) {
    const invokeAgentRows = rows.filter(
      (h) => typeof h.operation_name === 'string' && (h.operation_name as string).startsWith('invoke_agent '),
    )
    const invokeAgentSpanIds = new Set(invokeAgentRows.map((h) => String(h.span_id)))
    const outermost = invokeAgentRows.find((h) => {
      const parent = h.reference_parent_span_id
      return typeof parent !== 'string' || !invokeAgentSpanIds.has(parent)
    })
    if (outermost && typeof outermost.operation_name === 'string') {
      const hex = extractAgentInstanceId(outermost.operation_name)
      if (hex) {
        sessionId = hex
        source = 'agent-instance'
      }
    }
  }

  if (!sessionId || !source) return undefined

  // Per-trace rollup: time range, agents, chat-span tokens/cost, error flag.
  let startMs = Number.POSITIVE_INFINITY
  let endMs = 0
  const agents = new Set<string>()
  let tokens = 0
  let cost = 0
  let hasError = false
  for (const h of rows) {
    const s = Math.floor(Number(h.start_time ?? 0) / 1_000_000)
    const e = Math.floor(Number(h.end_time ?? 0) / 1_000_000)
    if (s && s < startMs) startMs = s
    if (e > endMs) endMs = e
    if (typeof h.operation_name === 'string') {
      const agent = extractAgentName(h.operation_name)
      if (agent) agents.add(agent)
    }
    if (h.gen_ai_operation_name === 'chat') {
      const t = num(h.llm_usage_tokens_total)
      if (t) tokens += t
      const c = num(h.llm_usage_cost_total)
      if (c) cost += c
    }
    if (h.span_status === 'ERROR') hasError = true
  }
  return {
    traceId,
    sessionId,
    source,
    startMs: startMs === Number.POSITIVE_INFINITY ? 0 : startMs,
    endMs,
    agents,
    tokens,
    cost,
    hasError,
  }
}

function kindFromNumber(raw: unknown): SpanKind {
  // OTel SpanKind: 0 UNSPECIFIED, 1 INTERNAL, 2 SERVER, 3 CLIENT, 4 PRODUCER, 5 CONSUMER
  const n = Number(raw)
  switch (n) {
    case 2:
      return 'server'
    case 3:
      return 'client'
    case 4:
      return 'producer'
    case 5:
      return 'consumer'
    default:
      return 'internal'
  }
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
