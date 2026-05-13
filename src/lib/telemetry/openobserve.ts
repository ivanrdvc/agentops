import { classifySpan, extractAgentInstanceId, extractAgentName, SESSION_ID_KEYS } from '#/lib/classify-span'
import { propagateSessionInTrace, type Span, type SpanKind } from '#/lib/spans'
import type {
  GetTraceOpts,
  InventoryDiscoveryKind,
  InventoryObservation,
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

const SESSION_ID_SELECT = SESSION_ID_KEYS.join(', ')
const SESSION_ID_NOT_NULL = SESSION_ID_KEYS.map((k) => `${k} IS NOT NULL`).join(' OR ')
const SESSION_ID_MAX_AS =
  SESSION_ID_KEYS.length === 1
    ? `MAX(${SESSION_ID_KEYS[0]})`
    : `COALESCE(${SESSION_ID_KEYS.map((k) => `MAX(${k})`).join(', ')})`
// `tryWithFallback` keys off one missing column name today — fine while
// SESSION_ID_KEYS has one entry. Generalize when a second key lands.
const SESSION_ID_FALLBACK_KEY = SESSION_ID_KEYS[0]

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
      const text = await resp.text()
      // 20002 = stream not yet created (nothing ingested) — treat as empty.
      if (resp.status === 400 && text.includes('"code":20002')) {
        return { hits: [] }
      }
      throw new Error(`OpenObserve ${resp.status}: ${text}`)
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
      const buildSql = (withThread: boolean) => `
        SELECT
          trace_id,
          span_id,
          reference_parent_span_id,
          operation_name,
          ${withThread ? `${SESSION_ID_SELECT},` : ''}
          start_time,
          end_time,
          gen_ai_operation_name,
          llm_usage_tokens_total,
          llm_usage_cost_total,
          span_status
        FROM "${cfg.stream}"
        WHERE operation_name LIKE 'invoke_agent %'
           OR gen_ai_operation_name = 'chat'
           ${withThread ? `OR ${SESSION_ID_NOT_NULL}` : ''}
        ORDER BY start_time DESC
        LIMIT ${SESSION_SCAN_LIMIT}
      `
      const data = await tryWithFallback(
        () => search(buildSql(true), fromUs, toUs, SESSION_SCAN_LIMIT),
        () => search(buildSql(false), fromUs, toUs, SESSION_SCAN_LIMIT),
        SESSION_ID_FALLBACK_KEY,
      )
      const hits = (data.hits ?? []) as Array<Record<string, unknown>>
      const truncated = hits.length >= SESSION_SCAN_LIMIT
      return { sessions: aggregateSessions(hits, limit), truncated }
    },

    async getSession(sessionId, opts): Promise<SessionFetch> {
      // SQL-injection guard for the interpolated WHERE below.
      if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) return { kind: 'not_found' }
      const isHex = /^[a-f0-9]+$/i.test(sessionId)
      const { fromUs, toUs } = window(opts)
      const buildTraceSql = (withThread: boolean) => {
        const clauses: string[] = []
        if (withThread) clauses.push(...SESSION_ID_KEYS.map((k) => `${k} = '${sessionId}'`))
        if (isHex) clauses.push(`operation_name LIKE 'invoke_agent %(${sessionId})%'`)
        return clauses.length === 0
          ? null
          : `SELECT DISTINCT trace_id FROM "${cfg.stream}" WHERE ${clauses.join(' OR ')}`
      }
      const primarySql = buildTraceSql(true)
      if (!primarySql) return { kind: 'not_found' }
      const fallbackSql = buildTraceSql(false)
      const trData = await tryWithFallback(
        () => search(primarySql, fromUs, toUs),
        () => (fallbackSql ? search(fallbackSql, fromUs, toUs) : Promise.resolve({ hits: [] })),
        SESSION_ID_FALLBACK_KEY,
      )
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
      const buildSql = (withThread: boolean) => `
        SELECT
          trace_id,
          MIN(start_time) AS first_seen,
          MAX(end_time)   AS last_seen,
          COUNT(*)        AS span_count,
          SUM(CASE WHEN gen_ai_operation_name = 'chat' THEN llm_usage_tokens_total ELSE 0 END) AS total_tokens,
          SUM(CASE WHEN gen_ai_operation_name = 'chat' THEN llm_usage_cost_total   ELSE 0 END) AS total_cost,
          MAX(CASE WHEN operation_name LIKE 'invoke_agent %' THEN operation_name END) AS sample_agent,
          MAX(CASE WHEN span_status = 'ERROR' THEN 1 ELSE 0 END) AS has_error,
          ${withThread ? `${SESSION_ID_MAX_AS} AS session_id,` : ''}
          MAX(service_name)    AS service_name
        FROM "${cfg.stream}"
        WHERE gen_ai_operation_name IS NOT NULL
        GROUP BY trace_id
        ORDER BY first_seen DESC
        LIMIT ${limit}
      `
      const data = await tryWithFallback(
        () => search(buildSql(true), fromUs, toUs, limit),
        () => search(buildSql(false), fromUs, toUs, limit),
        SESSION_ID_FALLBACK_KEY,
      )
      const hits = (data.hits ?? []) as Array<Record<string, unknown>>
      return hits.map(hitToSummary)
    },

    async discoverInventory(kind, opts) {
      const { fromUs, toUs } = window(opts)
      const isTool = kind === 'new_tool'
      const sql = `
        SELECT
          operation_name,
          MIN(start_time) AS first_seen,
          MAX(start_time) AS last_seen,
          MIN(trace_id) AS sample_trace_id
        FROM "${cfg.stream}"
        WHERE operation_name LIKE '${isTool ? 'execute_tool' : 'invoke_agent'} %'
        GROUP BY operation_name
        ORDER BY first_seen DESC
        LIMIT 1000
      `
      const data = await search(sql, fromUs, toUs, 1000)
      const hits = (data.hits ?? []) as Array<Record<string, unknown>>
      return hits.flatMap((hit) => hitToInventoryObservation(kind, hit))
    },
  }
}

async function tryWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  missingField: string,
): Promise<T> {
  try {
    return await primary()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('"code":20004') && msg.includes(`No field named ${missingField}`)) {
      return await fallback()
    }
    throw e
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

function hitToInventoryObservation(kind: InventoryDiscoveryKind, h: Record<string, unknown>): InventoryObservation[] {
  const operationName = String(h.operation_name ?? '')
  const name = kind === 'new_tool' ? extractToolName(operationName) : extractAgentName(operationName)
  if (!name) return []

  const firstSeenNs = Number(h.first_seen ?? 0)
  const lastSeenNs = Number(h.last_seen ?? firstSeenNs)
  return [
    {
      kind: kind === 'new_tool' ? 'mcp_tool' : 'agent',
      name,
      namespace: '',
      firstSeenMs: Math.floor(firstSeenNs / 1_000_000),
      lastSeenMs: Math.floor(lastSeenNs / 1_000_000),
      traceId: typeof h.sample_trace_id === 'string' ? h.sample_trace_id : undefined,
    },
  ]
}

function extractToolName(spanName: string): string | undefined {
  const m = spanName.match(/^execute_tool\s+(\S+)/)
  return m?.[1]
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
export function aggregateSessions(hits: Array<Record<string, unknown>>, limit: number): SessionSummary[] {
  // Group rows by trace_id.
  const rowsByTrace = new Map<string, Array<Record<string, unknown>>>()
  for (const h of hits) {
    const traceId = String(h.trace_id ?? '')
    if (!traceId) continue
    const arr = rowsByTrace.get(traceId) ?? []
    arr.push(h)
    rowsByTrace.set(traceId, arr)
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

function resolveTraceSession(traceId: string, rows: Array<Record<string, unknown>>): TraceSession | undefined {
  const key = findSessionKey(rows)
  if (!key) return undefined
  return { traceId, sessionId: key.id, source: key.source, ...rollupTrace(rows) }
}

export function findSessionKey(
  rows: Array<Record<string, unknown>>,
): { id: string; source: 'attribute' | 'agent-instance' } | undefined {
  for (const h of rows) {
    for (const k of SESSION_ID_KEYS) {
      const v = h[k]
      if (typeof v === 'string' && v) return { id: v, source: 'attribute' }
    }
  }
  // Heuristic: hex of the earliest-starting invoke_agent. Parent starts
  // before child, so the root agent is always first by start_time.
  let root: Record<string, unknown> | undefined
  for (const h of rows) {
    const op = h.operation_name
    if (typeof op !== 'string' || !op.startsWith('invoke_agent ')) continue
    if (!root || Number(h.start_time ?? 0) < Number(root.start_time ?? 0)) root = h
  }
  if (!root) return undefined
  const hex = extractAgentInstanceId(String(root.operation_name))
  return hex ? { id: hex, source: 'agent-instance' } : undefined
}

function rollupTrace(rows: Array<Record<string, unknown>>): Omit<TraceSession, 'traceId' | 'sessionId' | 'source'> {
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
