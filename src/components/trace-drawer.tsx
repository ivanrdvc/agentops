import * as Headless from '@headlessui/react'
import { ChevronDownIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useMemo, useState } from 'react'
import { formatCost, type Span } from '#/lib/spans'

interface TraceDrawerProps {
  open: boolean
  onClose: () => void
  spans: Span[]
  loading?: boolean
  title?: string
}

export function TraceDrawer({ open, onClose, spans, loading, title }: TraceDrawerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? spans.find((s) => s.id === selectedId) : null

  return (
    <Headless.Dialog open={open} onClose={onClose}>
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 z-40 bg-zinc-950/40 transition-opacity duration-500 ease-in-out data-closed:opacity-0 dark:bg-zinc-950/60"
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[940px]">
        <Headless.DialogPanel
          transition
          className="flex w-full flex-col bg-white shadow-2xl ring-1 ring-zinc-950/10 transition-transform duration-500 ease-in-out data-closed:translate-x-full dark:bg-zinc-900 dark:ring-white/10"
        >
          <header className="flex items-center justify-between border-b border-zinc-950/10 px-4 py-2.5 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">Trace</h2>
              {title && <span className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{title}</span>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <XMarkIcon className="size-4 fill-current" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            <section className="w-1/3 min-w-0 shrink-0 overflow-auto border-r border-zinc-950/10 dark:border-white/10">
              {loading && spans.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
                  Loading trace…
                </div>
              ) : (
                <TraceList spans={spans} selectedId={selectedId} onSelect={setSelectedId} />
              )}
            </section>
            <section className="min-w-0 flex-1 overflow-auto">
              {selected ? (
                <DetailPanel span={selected} />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
                  Select an item to see details
                </div>
              )}
            </section>
          </div>
        </Headless.DialogPanel>
      </div>
    </Headless.Dialog>
  )
}

interface Row {
  span: Span
  ancestorHasNext: boolean[]
  isLastChild: boolean
  childCount: number
  isCollapsed: boolean
  subtreeTokens: number
  subtreeCost: number
}

interface Display {
  name: string
  tagLabel: string
  tagCls: string
}

const RAIL_WIDTH = 18
const CIRCLE_SIZE = 16
const TREE_LINE = 'bg-zinc-300 dark:bg-zinc-700'

const SPAN_TAGS: Record<string, { tagLabel: string; tagCls: string }> = {
  invoke_agent: { tagLabel: 'agent', tagCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  chat: { tagLabel: 'llm', tagCls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  tool: { tagLabel: 'tool', tagCls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
}

function displayFor(span: Span): Display {
  const tag = SPAN_TAGS[span.operation]
  return {
    name: span.toolName ?? span.agentName ?? span.name,
    tagLabel: tag?.tagLabel ?? '',
    tagCls: tag?.tagCls ?? '',
  }
}

function buildRows(spans: Span[], collapsedIds: Set<string>): Row[] {
  const byId = new Map(spans.map((span) => [span.id, span]))
  const byParent = new Map<string | null, Span[]>()
  for (const span of spans) {
    const siblings = byParent.get(span.parentId) ?? []
    siblings.push(span)
    byParent.set(span.parentId, siblings)
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.startMs - b.startMs)

  // Hide spans classified as plain http — those are the SDK-level transport
  // calls (POST /v1/chat/completions etc.). Children re-parent up so the
  // tree stays connected.
  const visibleChildren = new Map<string | null, Span[]>()
  const collect = (parentId: string | null): Span[] => {
    if (visibleChildren.has(parentId)) return visibleChildren.get(parentId) as Span[]
    const out: Span[] = []
    for (const span of byParent.get(parentId) ?? []) {
      if (span.operation === 'http') out.push(...collect(span.id))
      else out.push(span)
    }
    visibleChildren.set(parentId, out)
    return out
  }

  const aggCache = new Map<string, { tokens: number; cost: number }>()
  const agg = (id: string): { tokens: number; cost: number } => {
    const cached = aggCache.get(id)
    if (cached) return cached
    const self = byId.get(id)
    if (!self) return { tokens: 0, cost: 0 }
    let tokens = self.tokens ?? 0
    let cost = self.costUsd ?? 0
    for (const child of byParent.get(id) ?? []) {
      const sub = agg(child.id)
      tokens += sub.tokens
      cost += sub.cost
    }
    const result = { tokens, cost }
    aggCache.set(id, result)
    return result
  }

  const rows: Row[] = []
  const walk = (parentId: string | null, ancestorHasNext: boolean[]) => {
    const siblings = collect(parentId)
    siblings.forEach((span, i) => {
      const isLast = i === siblings.length - 1
      const totals = agg(span.id)
      const children = collect(span.id)
      rows.push({
        span,
        ancestorHasNext: [...ancestorHasNext],
        isLastChild: isLast,
        childCount: children.length,
        isCollapsed: collapsedIds.has(span.id),
        subtreeTokens: totals.tokens,
        subtreeCost: totals.cost,
      })
      if (!collapsedIds.has(span.id)) walk(span.id, [...ancestorHasNext, !isLast])
    })
  }
  walk(null, [])
  return rows
}

interface TraceListProps {
  spans: Span[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function TraceList({ spans, selectedId, onSelect }: TraceListProps) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set<string>())
  const rows = useMemo(() => buildRows(spans, collapsedIds), [spans, collapsedIds])

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-zinc-400 dark:text-zinc-600">
        No spans in this session.
      </div>
    )
  }

  return (
    <ul>
      {rows.map((row) => (
        <TraceRow
          key={row.span.id}
          row={row}
          selected={row.span.id === selectedId}
          onSelect={() => onSelect(row.span.id)}
          onToggleCollapse={() => toggleCollapsed(row.span.id)}
        />
      ))}
    </ul>
  )
}

interface TraceRowProps {
  row: Row
  selected: boolean
  onSelect: () => void
  onToggleCollapse: () => void
}

function TraceRow({ row, selected, onSelect, onToggleCollapse }: TraceRowProps) {
  const { span, ancestorHasNext, isLastChild, childCount, isCollapsed, subtreeTokens, subtreeCost } = row
  const display = displayFor(span)
  const durationMs = span.endMs - span.startMs
  const cost = formatCost(subtreeCost)
  const showTokens = span.inputTokens != null || span.outputTokens != null

  return (
    <li>
      <div
        className={[
          'relative flex min-h-10 w-full cursor-pointer items-stretch text-left text-xs',
          selected ? 'bg-indigo-500/10 dark:bg-indigo-400/10' : 'hover:bg-zinc-50 dark:hover:bg-white/5',
        ].join(' ')}
      >
        <div className="flex shrink-0 pl-2">
          {ancestorHasNext.map((hasNext, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rail count equals depth, fixed for a given span
            <div key={`${span.id}-rail-${i}`} className="relative" style={{ width: RAIL_WIDTH }} aria-hidden>
              {hasNext && <div className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${TREE_LINE}`} />}
            </div>
          ))}

          {ancestorHasNext.length > 0 && (
            <div className="relative" style={{ width: RAIL_WIDTH }} aria-hidden>
              <div
                className={[
                  `absolute left-1/2 top-0 w-px -translate-x-1/2 ${TREE_LINE}`,
                  isLastChild ? 'h-1/2' : 'h-full',
                ].join(' ')}
              />
              <div className={`absolute left-1/2 top-1/2 h-px w-1/2 -translate-y-1/2 ${TREE_LINE}`} />
            </div>
          )}

          <div className="relative" style={{ width: childCount > 0 ? CIRCLE_SIZE + 8 : 0 }}>
            {childCount > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleCollapse()
                }}
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${display.name}`}
                title={isCollapsed ? 'Expand children' : 'Collapse children'}
                className={[
                  'group absolute top-1/2 flex items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset transition-colors -translate-y-1/2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500/80',
                  isCollapsed
                    ? 'bg-zinc-800 text-white ring-zinc-800 dark:bg-zinc-200 dark:text-zinc-900 dark:ring-zinc-200'
                    : 'bg-zinc-200 text-zinc-700 ring-zinc-300 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-700',
                ].join(' ')}
                style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
              >
                <span className="group-hover:hidden group-focus-visible:hidden">{childCount}</span>
                {isCollapsed ? (
                  <ChevronRightIcon className="hidden size-3 group-hover:block group-focus-visible:block" />
                ) : (
                  <ChevronDownIcon className="hidden size-3 group-hover:block group-focus-visible:block" />
                )}
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 pr-2 text-left leading-tight focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/80"
        >
          <div className="flex min-w-0 items-center gap-2">
            {display.tagLabel && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${display.tagCls}`}>
                {display.tagLabel}
              </span>
            )}
            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{display.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>{formatDuration(durationMs)}</span>
            {showTokens && (
              <span>
                {fmtNum(span.inputTokens)} → {fmtNum(span.outputTokens)}
                {span.tokens != null && (
                  <span className="text-zinc-400 dark:text-zinc-600"> (∑ {fmtNum(span.tokens)})</span>
                )}
              </span>
            )}
            {cost && (
              <span>
                <span className="text-zinc-400 dark:text-zinc-600">∑</span> ${cost}
              </span>
            )}
            {subtreeTokens > 0 && !showTokens && (
              <span>
                <span className="text-zinc-400 dark:text-zinc-600">∑</span> {fmtNum(subtreeTokens)} tok
              </span>
            )}
          </div>
        </button>
      </div>
    </li>
  )
}

function DetailPanel({ span }: { span: Span }) {
  const duration = span.endMs - span.startMs
  const cost = formatCost(span.costUsd ?? 0)
  const display = displayFor(span)

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-2">
        {display.tagLabel && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${display.tagCls}`}>
            {display.tagLabel}
          </span>
        )}
        <span className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{display.name}</span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <Stat label="Duration" value={formatDuration(duration)} />
        {span.inputTokens != null && <Stat label="Input" value={fmtNum(span.inputTokens)} />}
        {span.outputTokens != null && <Stat label="Output" value={fmtNum(span.outputTokens)} />}
        {span.tokens != null && <Stat label="Tokens" value={fmtNum(span.tokens)} />}
        {cost && <Stat label="Cost" value={`$${cost}`} />}
        {span.model && <Stat label="Model" value={span.model} />}
      </dl>

      {span.inputParams && <JsonBlock label="Input" raw={span.inputParams} />}
      {span.toolResult != null && <JsonBlock label="Result" value={span.toolResult} />}
      {span.llmInput != null && <JsonBlock label="LLM Input" value={span.llmInput} />}
      {span.llmOutput != null && <JsonBlock label="LLM Output" value={span.llmOutput} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">{value}</dd>
    </>
  )
}

function JsonBlock({ label, value, raw }: { label: string; value?: unknown; raw?: string }) {
  const text =
    raw ??
    (() => {
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return String(value)
      }
    })()
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <pre className="max-h-96 overflow-auto rounded-md bg-zinc-50 p-2 text-[11px] leading-snug text-zinc-800 ring-1 ring-zinc-950/5 dark:bg-zinc-950/60 dark:text-zinc-200 dark:ring-white/10">
        {text}
      </pre>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function fmtNum(n: number | undefined): string {
  if (n == null) return '0'
  return n.toLocaleString()
}
