import { describe, expect, it } from 'vitest'
import { aggregateSessions, findSessionKey } from './openobserve'

const NS_PER_MS = 1_000_000

type Row = Record<string, unknown>

function invokeAgent(opts: {
  trace: string
  span: string
  parent?: string
  agent: string
  hex: string
  startMs: number
  endMs?: number
}): Row {
  return {
    trace_id: opts.trace,
    span_id: opts.span,
    reference_parent_span_id: opts.parent ?? null,
    operation_name: `invoke_agent ${opts.agent}(${opts.hex})`,
    start_time: opts.startMs * NS_PER_MS,
    end_time: (opts.endMs ?? opts.startMs + 100) * NS_PER_MS,
  }
}

function chat(opts: {
  trace: string
  span: string
  parent: string
  startMs: number
  tokens?: number
  cost?: number
  error?: boolean
}): Row {
  return {
    trace_id: opts.trace,
    span_id: opts.span,
    reference_parent_span_id: opts.parent,
    operation_name: 'chat gpt-4o-mini',
    gen_ai_operation_name: 'chat',
    start_time: opts.startMs * NS_PER_MS,
    end_time: (opts.startMs + 50) * NS_PER_MS,
    llm_usage_tokens_total: opts.tokens,
    llm_usage_cost_total: opts.cost,
    span_status: opts.error ? 'ERROR' : 'OK',
  }
}

describe('findSessionKey', () => {
  it('returns attribute id when ag_ui_thread_id is present', () => {
    const rows: Row[] = [{ ag_ui_thread_id: 'thread-abc', operation_name: 'chat' }]
    expect(findSessionKey(rows)).toEqual({ id: 'thread-abc', source: 'attribute' })
  })

  it('prefers attribute over heuristic when both apply', () => {
    const rows: Row[] = [
      invokeAgent({ trace: 't1', span: 'a', agent: 'Bot', hex: 'deadbeef', startMs: 0 }),
      { ag_ui_thread_id: 'thread-abc' },
    ]
    expect(findSessionKey(rows)).toEqual({ id: 'thread-abc', source: 'attribute' })
  })

  it('picks the single invoke_agent hex when no attribute is set', () => {
    const rows: Row[] = [invokeAgent({ trace: 't1', span: 'a', agent: 'Bot', hex: 'deadbeef', startMs: 0 })]
    expect(findSessionKey(rows)).toEqual({ id: 'deadbeef', source: 'agent-instance' })
  })

  it('picks the parent agent (earliest start) when a sub-agent is nested', () => {
    // Regression: rows arrive in DESC start_time order, and the execute_tool
    // bridge between parent and sub-agent is not in the result set, so the
    // sub-agent looks parentless. Earliest start wins.
    const parent = invokeAgent({ trace: 't1', span: 'p', agent: 'Proverbs', hex: 'aaaa', startMs: 1000 })
    const sub = invokeAgent({
      trace: 't1',
      span: 's',
      parent: 'tool-bridge',
      agent: 'Explorer',
      hex: 'bbbb',
      startMs: 1100,
    })
    expect(findSessionKey([sub, parent])).toEqual({ id: 'aaaa', source: 'agent-instance' })
  })

  it('returns undefined when no agent and no attribute', () => {
    const rows: Row[] = [chat({ trace: 't1', span: 'c', parent: 'x', startMs: 0 })]
    expect(findSessionKey(rows)).toBeUndefined()
  })
})

describe('aggregateSessions', () => {
  it('groups traces by attribute session id', () => {
    const hits: Row[] = [
      {
        trace_id: 't1',
        span_id: 'a',
        operation_name: 'invoke_agent Bot(11)',
        ag_ui_thread_id: 'thread-1',
        start_time: 1000 * NS_PER_MS,
        end_time: 1100 * NS_PER_MS,
      },
      {
        trace_id: 't2',
        span_id: 'b',
        operation_name: 'invoke_agent Bot(22)',
        ag_ui_thread_id: 'thread-1',
        start_time: 2000 * NS_PER_MS,
        end_time: 2100 * NS_PER_MS,
      },
    ]
    const out = aggregateSessions(hits, 10)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ sessionId: 'thread-1', source: 'attribute', traceCount: 2, agents: ['Bot'] })
  })

  it('rolls up tokens, cost, and error flag across traces in a session', () => {
    const hits: Row[] = [
      invokeAgent({ trace: 't1', span: 'a', agent: 'Bot', hex: 'aaaa', startMs: 1000 }),
      chat({ trace: 't1', span: 'c1', parent: 'a', startMs: 1010, tokens: 100, cost: 0.001 }),
      invokeAgent({ trace: 't2', span: 'b', agent: 'Bot', hex: 'aaaa', startMs: 2000 }),
      chat({ trace: 't2', span: 'c2', parent: 'b', startMs: 2010, tokens: 50, cost: 0.0005, error: true }),
    ]
    const [session] = aggregateSessions(hits, 10)
    expect(session.sessionId).toBe('aaaa')
    expect(session.traceCount).toBe(2)
    expect(session.totalTokens).toBe(150)
    expect(session.totalCostUsd).toBeCloseTo(0.0015)
    expect(session.hasError).toBe(true)
  })

  it('buckets a parent+sub-agent trace under the parent (not the sub-agent)', () => {
    // The bug: this trace would split into two sessions before the fix.
    const hits: Row[] = [
      invokeAgent({ trace: 't1', span: 'p', agent: 'Proverbs', hex: 'aaaa', startMs: 1000 }),
      invokeAgent({ trace: 't1', span: 's', parent: 'tool', agent: 'Explorer', hex: 'bbbb', startMs: 1100 }),
      invokeAgent({ trace: 't2', span: 'p2', agent: 'Proverbs', hex: 'aaaa', startMs: 2000 }),
    ]
    const out = aggregateSessions(hits, 10)
    expect(out).toHaveLength(1)
    expect(out[0].sessionId).toBe('aaaa')
    expect(out[0].traceCount).toBe(2)
    expect(out[0].agents.sort()).toEqual(['Explorer', 'Proverbs'])
  })

  it('respects the limit', () => {
    const hits: Row[] = [
      invokeAgent({ trace: 't1', span: 'a', agent: 'A', hex: '1111', startMs: 1000 }),
      invokeAgent({ trace: 't2', span: 'b', agent: 'B', hex: '2222', startMs: 2000 }),
      invokeAgent({ trace: 't3', span: 'c', agent: 'C', hex: '3333', startMs: 3000 }),
    ]
    expect(aggregateSessions(hits, 2)).toHaveLength(2)
  })
})
