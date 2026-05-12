import type { Operation, Span, SpanKind } from '#/lib/spans'

// Shape we accept at the boundary. Loose on purpose — matches what OTel
// collectors and OpenObserve actually serialize (see docs/ai-attributes.md).
// Times in nanoseconds; we normalize to ms. Attribute keys may use either
// dotted (`gen_ai.request.model`) or flattened (`gen_ai_request_model`) form.
export interface RawSpan {
  span_id: string
  reference_parent_span_id?: string | null
  name: string
  start_time: number
  end_time: number
  span_kind?: number
  service_name?: string
  attributes?: Record<string, unknown>
}

const KIND_BY_NUMBER: Record<number, SpanKind> = {
  1: 'internal',
  2: 'server',
  3: 'client',
  4: 'producer',
  5: 'consumer',
}

export function ingestSpans(raw: RawSpan[]): Span[] {
  return raw.map(normalize)
}

function normalize(r: RawSpan): Span {
  const attrs = r.attributes ?? {}
  return {
    id: r.span_id,
    parentId: r.reference_parent_span_id || null,
    service: r.service_name ?? 'unknown',
    kind: KIND_BY_NUMBER[r.span_kind ?? 1] ?? 'internal',
    operation: pickOperation(r.name, attrs),
    name: r.name,
    startMs: Math.floor(r.start_time / 1_000_000),
    endMs: Math.floor(r.end_time / 1_000_000),
    tokens: pickNumber(attrs, ['gen_ai.usage.total_tokens', 'gen_ai_usage_total_tokens', 'llm_usage_tokens_total']),
    costUsd: pickNumber(attrs, ['llm_usage_cost_total', 'gen_ai.usage.cost_total']),
    agentName: pickString(attrs, ['gen_ai.agent.name', 'gen_ai_agent_name']),
    toolName: pickString(attrs, ['gen_ai.tool.name', 'gen_ai_tool_name']),
    inputParams: pickString(attrs, ['gen_ai.tool.call.arguments', 'gen_ai_tool_call_arguments']),
    model: pickString(attrs, [
      'gen_ai.request.model',
      'gen_ai_request_model',
      'gen_ai.response.model',
      'gen_ai_response_model',
    ]),
  }
}

function pickOperation(name: string, attrs: Record<string, unknown>): Operation {
  const op = pickString(attrs, ['gen_ai.operation.name', 'gen_ai_operation_name'])
  if (op === 'chat') return 'chat'
  if (op === 'invoke_agent') return 'invoke_agent'
  if (op === 'execute_tool') return 'tool'
  if (name.startsWith('chat ')) return 'chat'
  if (name.startsWith('invoke_agent')) return 'invoke_agent'
  if (name.startsWith('execute_tool')) return 'tool'
  return 'http'
}

function pickNumber(attrs: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = attrs[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

function pickString(attrs: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = attrs[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}
