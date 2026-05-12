import type { Operation, Span, SpanKind } from '#/lib/spans'
import type {
  GetTraceOpts,
  ListTracesOpts,
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
      const truncated = hits.length >= DEFAULT_SIZE
      return { kind: 'found', spans, truncated }
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
          MAX(CASE WHEN span_status = 'ERROR' THEN 1 ELSE 0 END) AS has_error
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
  return summary
}

function normalizeOpenObserveHit(h: Record<string, unknown>): Span {
  const operationName = String(h.operation_name ?? '?')
  const genAiOp = h.gen_ai_operation_name as string | undefined

  const operation = inferOperation(genAiOp, operationName)
  const span: Span = {
    id: String(h.span_id),
    parentId: (h.reference_parent_span_id as string) || null,
    service: String(h.service_name ?? 'unknown'),
    kind: kindFromNumber(h.span_kind),
    operation,
    name: operationName,
    // OpenObserve stores start_time/end_time in nanoseconds, duration in microseconds.
    // We normalize to ms throughout the app.
    startMs: Math.floor(Number(h.start_time ?? 0) / 1_000_000),
    endMs: Math.floor(Number(h.end_time ?? 0) / 1_000_000),
  }

  const tokens = num(h.llm_usage_tokens_total)
  if (tokens !== undefined) span.tokens = tokens

  const cost = num(h.llm_usage_cost_total)
  if (cost !== undefined) span.costUsd = cost

  const model = (h.gen_ai_request_model ?? h.gen_ai_response_model) as string | undefined
  if (model) span.model = model

  if (operation === 'invoke_agent') {
    span.agentName = extractAgentName(operationName)
  }
  if (operation === 'tool') {
    span.toolName = extractToolName(operationName)
    const args = h.gen_ai_tool_call_arguments
    if (typeof args === 'string') span.inputParams = args
  }

  return span
}

function inferOperation(genAi: string | undefined, opName: string): Operation {
  if (genAi === 'chat' || genAi === 'text_completion' || genAi === 'generate_content') return 'chat'
  if (genAi === 'invoke_agent' || genAi === 'create_agent') return 'invoke_agent'
  if (genAi === 'execute_tool') return 'tool'

  // Fall back to pattern matching the free-form span name.
  if (opName.startsWith('chat ')) return 'chat'
  if (opName.startsWith('invoke_agent ')) return 'invoke_agent'
  if (opName.startsWith('execute_tool ')) return 'tool'
  return 'http'
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

function extractAgentName(opName: string): string | undefined {
  // "invoke_agent Explorer(a9bc...)" -> "Explorer"
  const m = opName.match(/^invoke_agent\s+([^(\s]+)/)
  return m?.[1]
}

function extractToolName(opName: string): string | undefined {
  // "execute_tool explore" -> "explore"
  const m = opName.match(/^execute_tool\s+(\S+)/)
  return m?.[1]
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
