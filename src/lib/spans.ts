export type SpanKind = 'server' | 'client' | 'internal' | 'producer' | 'consumer'
export type Operation = 'http' | 'chat' | 'tool' | 'invoke_agent'

export interface Span {
  id: string
  parentId: string | null
  service: string
  kind: SpanKind
  operation: Operation
  name: string
  startMs: number
  endMs: number
  tokens?: number
  costUsd?: number
  agentName?: string
  toolName?: string
  inputParams?: string
  model?: string
}

export const KIND_LETTER: Record<SpanKind, string> = {
  server: 's',
  client: 'c',
  internal: 'i',
  producer: 'p',
  consumer: 'u',
}

// Subtree aggregate (this span + all descendants).
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
  const depth = (id: string): number => {
    const s = byId.get(id)
    if (!s || s.parentId === null) return 0
    return 1 + depth(s.parentId)
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
