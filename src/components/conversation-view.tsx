import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { useMemo, useState } from 'react'
import { buildConversation, type ConversationEvent } from '#/lib/conversation'
import type { Span } from '#/lib/spans'

interface ConversationViewProps {
  spans: Span[]
  onSelect: (id: string) => void
}

interface EventContext {
  selectedKey: string | null
  expanded: Set<string>
  resultByCallId: Map<string, Extract<ConversationEvent, { kind: 'tool_result' }>>
  childrenByParent: Map<string, ConversationEvent[]>
  selectEvent: (key: string, spanId: string | undefined) => void
  toggle: (id: string) => void
}

export function ConversationView({ spans, onSelect }: ConversationViewProps) {
  const events = useMemo(() => buildConversation(spans), [spans])

  const { topLevel, childrenByParent, resultByCallId } = useMemo(() => {
    const top: ConversationEvent[] = []
    const children = new Map<string, ConversationEvent[]>()
    const resultByCall = new Map<string, Extract<ConversationEvent, { kind: 'tool_result' }>>()
    for (const e of events) {
      if (e.kind === 'tool_result') resultByCall.set(e.callId, e)
      const parent = 'parentAgentSpanId' in e ? e.parentAgentSpanId : undefined
      if (parent) {
        const arr = children.get(parent) ?? []
        arr.push(e)
        children.set(parent, arr)
      } else {
        top.push(e)
      }
    }
    return { topLevel: top, childrenByParent: children, resultByCallId: resultByCall }
  }, [events])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selectEvent = (key: string, spanId: string | undefined) => {
    setSelectedKey(key)
    if (spanId) onSelect(spanId)
  }

  if (events.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        No conversation data in this run.
      </div>
    )
  }

  const ctx: EventContext = { selectedKey, expanded, resultByCallId, childrenByParent, selectEvent, toggle }

  return <div className="flex flex-col gap-3 p-4">{topLevel.map((event) => renderEvent(event, ctx))}</div>
}

function renderEvent(event: ConversationEvent, ctx: EventContext) {
  if (event.kind === 'tool_result') return null

  if (event.kind === 'message') {
    const key = `msg-${event.spanId ?? ''}-${event.timestamp}-${event.role}`
    return <MessageBubble key={key} event={event} />
  }

  if (event.kind === 'tool_call') {
    const key = `call-${event.callId}`
    const result = ctx.resultByCallId.get(event.callId)
    return (
      <ToolCard
        key={key}
        call={event}
        result={result}
        expanded={ctx.expanded.has(event.callId)}
        onToggle={() => ctx.toggle(event.callId)}
        selected={ctx.selectedKey === key}
        onSelect={() => ctx.selectEvent(key, event.spanId)}
      />
    )
  }

  if (event.kind === 'agent_call') {
    const key = `agent-${event.spanId}`
    const nested = ctx.childrenByParent.get(event.spanId) ?? []
    return (
      <AgentCard
        key={key}
        event={event}
        nested={nested}
        expanded={ctx.expanded.has(event.spanId)}
        onToggle={() => ctx.toggle(event.spanId)}
        selected={ctx.selectedKey === key}
        onSelect={() => ctx.selectEvent(key, event.spanId)}
        ctx={ctx}
      />
    )
  }

  return null
}

interface MessageBubbleProps {
  event: Extract<ConversationEvent, { kind: 'message' }>
}

function MessageBubble({ event }: MessageBubbleProps) {
  const isUser = event.role === 'user'
  const hasTokens = event.inputTokens !== undefined || event.outputTokens !== undefined

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-zinc-100 px-3 py-2 text-xs text-zinc-950 dark:bg-white/10 dark:text-white">
          <div className="whitespace-pre-wrap">{event.content}</div>
          <div className="mt-1 text-right text-[10px] opacity-60">{formatTime(event.timestamp)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[75%] px-2 py-1 text-xs">
      {event.role !== 'assistant' && (
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {event.role}
        </div>
      )}
      <div className="whitespace-pre-wrap text-zinc-950 dark:text-white">{event.content}</div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>{formatTime(event.timestamp)}</span>
        {hasTokens && (
          <>
            <span aria-hidden>•</span>
            <TokenBadge input={event.inputTokens} output={event.outputTokens} />
          </>
        )}
      </div>
    </div>
  )
}

function TokenBadge({ input, output }: { input?: number; output?: number }) {
  const total = (input ?? 0) + (output ?? 0)
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      {input !== undefined && <span className="text-indigo-600 dark:text-indigo-400">↑{input}</span>}
      {output !== undefined && <span className="text-emerald-600 dark:text-emerald-400">↓{output}</span>}
      <span>({total} tokens)</span>
    </span>
  )
}

interface ToolCardProps {
  call: Extract<ConversationEvent, { kind: 'tool_call' }>
  result?: Extract<ConversationEvent, { kind: 'tool_result' }>
  expanded: boolean
  onToggle: () => void
  selected: boolean
  onSelect: () => void
}

function ToolCard({ call, result, expanded, onToggle, selected, onSelect }: ToolCardProps) {
  const status = !result ? 'pending' : result.success ? 'completed' : 'failed'

  return (
    <div
      className={[
        'rounded-md border text-xs',
        selected ? 'border-indigo-500/60 dark:border-indigo-400/60' : 'border-zinc-950/10 dark:border-white/10',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => {
          onToggle()
          onSelect()
        }}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-white/5"
      >
        <span className="text-zinc-500 dark:text-zinc-400">⚒</span>
        <span className="font-medium text-zinc-950 dark:text-white">{call.toolName}</span>
        <StatusPill status={status} />
        <span className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{formatTime(call.timestamp)}</span>
          {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-zinc-950/5 px-3 py-2 dark:border-white/5">
          <KeyValueBlock label="Arguments" value={call.arguments} />
          {result && <KeyValueBlock label="Result" value={result.result} />}
          {result?.error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[11px] text-rose-700 dark:text-rose-300">
              <span className="font-semibold">{result.error.kind}</span>
              {result.error.message && <span>: {result.error.message}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface AgentCardProps {
  event: Extract<ConversationEvent, { kind: 'agent_call' }>
  nested: ConversationEvent[]
  expanded: boolean
  onToggle: () => void
  selected: boolean
  onSelect: () => void
  ctx: EventContext
}

function AgentCard({ event, nested, expanded, onToggle, selected, onSelect, ctx }: AgentCardProps) {
  const hasChildren = nested.length > 0

  return (
    <div
      className={[
        'rounded-md border text-xs',
        selected ? 'border-violet-500/60 dark:border-violet-400/60' : 'border-violet-500/30 dark:border-violet-400/30',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => {
          onToggle()
          onSelect()
        }}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left hover:bg-violet-500/5 dark:hover:bg-violet-400/5"
      >
        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          agent
        </span>
        <span className="font-medium text-zinc-950 dark:text-white">{event.agentName}</span>
        {hasChildren && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            ({nested.length} event{nested.length === 1 ? '' : 's'})
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{formatTime(event.timestamp)}</span>
          {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-violet-500/15 px-3 py-2 dark:border-violet-400/15">
          <KeyValueBlock label="Input" value={event.input} />
          <KeyValueBlock label="Output" value={event.result} />
          {hasChildren && (
            <div className="space-y-2 border-t border-zinc-950/5 pt-2 dark:border-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Sub-agent activity
              </div>
              <div className="flex flex-col gap-2">{nested.map((c) => renderEvent(c, ctx))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: 'pending' | 'completed' | 'failed' }) {
  const cls =
    status === 'completed'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 'failed'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  const label = status === 'completed' ? '✓ Completed' : status === 'failed' ? '✗ Failed' : '⋯ Pending'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
}

function KeyValueBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <pre className="overflow-x-auto rounded bg-zinc-950/5 px-2 py-1.5 font-mono text-[11px] text-zinc-800 dark:bg-white/5 dark:text-zinc-200">
        {formatValue(value)}
      </pre>
    </div>
  )
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

function formatValue(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
