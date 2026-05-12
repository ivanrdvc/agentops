import type { JsonValue } from './json'

export type SpanKind = 'server' | 'client' | 'internal' | 'producer' | 'consumer'
export type Operation = 'http' | 'chat' | 'tool' | 'invoke_agent'

export interface Span {
  id: string
  traceId: string
  parentId: string | null
  service: string
  kind: SpanKind
  operation: Operation
  name: string
  startMs: number
  endMs: number
  tokens?: number
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  agentName?: string
  toolName?: string
  inputParams?: string
  model?: string

  // Present on chat spans — what the LLM was sent and what it replied.
  llmInput?: JsonValue
  llmOutput?: JsonValue

  // Present on execute_tool spans — pairing key and the tool's return value.
  toolCallId?: string
  toolResult?: JsonValue

  // Session correlation. `attribute` = lifted from a real semconv key
  // (session.id / gen_ai.conversation.id / langfuse.session.id / ...).
  // `agent-instance` = fallback derived from the agent-instance hex in
  // `invoke_agent <Name>(<hex>)` span names when no attribute is present.
  // UI discloses the source so heuristic-derived sessions don't masquerade
  // as real ones.
  sessionId?: string
  sessionSource?: 'attribute' | 'agent-instance'
}

// Stamp every span in a trace with the same sessionId. A real `attribute`
// source wins over the `agent-instance` heuristic when both appear in the
// same trace — so spans that didn't carry the attribute themselves get
// stamped with it rather than with a fallback hex.
export function propagateSessionInTrace(spans: Span[]): void {
  let attrId: string | undefined
  let heuristicId: string | undefined
  for (const s of spans) {
    if (!s.sessionId) continue
    if (s.sessionSource === 'attribute' && !attrId) attrId = s.sessionId
    else if (s.sessionSource === 'agent-instance' && !heuristicId) heuristicId = s.sessionId
  }
  const id = attrId ?? heuristicId
  if (!id) return
  const source: 'attribute' | 'agent-instance' = attrId ? 'attribute' : 'agent-instance'
  for (const s of spans) {
    if (!s.sessionId) {
      s.sessionId = id
      s.sessionSource = source
    }
  }
}

export const KIND_LETTER: Record<SpanKind, string> = {
  server: 's',
  client: 'c',
  internal: 'i',
  producer: 'p',
  consumer: 'u',
}

export function subtreeAggregate(spans: Span[], rootId: string): { tokens: number; costUsd: number } {
  const byParent = new Map<string | null, Span[]>()
  for (const s of spans) {
    const arr = byParent.get(s.parentId) ?? []
    arr.push(s)
    byParent.set(s.parentId, arr)
  }
  const walk = (id: string): { tokens: number; costUsd: number } => {
    const self = spans.find((s) => s.id === id)
    if (!self) return { tokens: 0, costUsd: 0 }
    let tokens = self.tokens ?? 0
    let costUsd = self.costUsd ?? 0
    for (const c of byParent.get(id) ?? []) {
      const sub = walk(c.id)
      tokens += sub.tokens
      costUsd += sub.costUsd
    }
    return { tokens, costUsd }
  }
  return walk(rootId)
}

export function findOrchestratorId(spans: Span[]): string | null {
  const byId = new Map(spans.map((s) => [s.id, s]))
  const memo = new Map<string, number>()
  const depth = (id: string): number => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    const s = byId.get(id)
    const d = !s || s.parentId === null ? 0 : 1 + depth(s.parentId)
    memo.set(id, d)
    return d
  }
  const agents = spans.filter((s) => s.operation === 'invoke_agent')
  agents.sort((a, b) => depth(a.id) - depth(b.id))
  return agents[0]?.id ?? null
}

// If a `tool` span wraps a sub-agent invocation (i.e. has an invoke_agent
// child), return that wrapped agent span. This is how OpenAI-style "agent as
// tool" patterns show up in real traces: execute_tool <name> → invoke_agent X.
export function findWrappedAgent(spans: Span[], toolId: string): Span | undefined {
  return spans.find((s) => s.parentId === toolId && s.operation === 'invoke_agent')
}

export function formatCost(usd: number): string | null {
  if (!usd) return null
  if (usd < 0.0001) return '<0.0001'
  return usd.toFixed(4)
}
