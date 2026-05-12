import { formatCost, KIND_LETTER, type Span } from '#/lib/spans'

interface FlatRow {
  span: Span
  depth: number
  ancestorHasNext: boolean[]
  isLastChild: boolean
  childCount: number
  subtreeTokens: number
  subtreeCost: number
}

function buildRows(spans: Span[]): FlatRow[] {
  const byParent = new Map<string | null, Span[]>()
  for (const s of spans) {
    const arr = byParent.get(s.parentId) ?? []
    arr.push(s)
    byParent.set(s.parentId, arr)
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.startMs - b.startMs)

  const aggregates = new Map<string, { tokens: number; cost: number }>()
  const agg = (id: string): { tokens: number; cost: number } => {
    const cached = aggregates.get(id)
    if (cached) return cached
    const self = spans.find((s) => s.id === id)
    if (!self) throw new Error(`span not found: ${id}`)
    let tokens = self.tokens ?? 0
    let cost = self.costUsd ?? 0
    for (const c of byParent.get(id) ?? []) {
      const sub = agg(c.id)
      tokens += sub.tokens
      cost += sub.cost
    }
    const result = { tokens, cost }
    aggregates.set(id, result)
    return result
  }

  const rows: FlatRow[] = []
  const walk = (parentId: string | null, ancestorHasNext: boolean[]) => {
    const siblings = byParent.get(parentId) ?? []
    siblings.forEach((s, i) => {
      const isLast = i === siblings.length - 1
      const sub = agg(s.id)
      rows.push({
        span: s,
        depth: ancestorHasNext.length,
        ancestorHasNext: [...ancestorHasNext],
        isLastChild: isLast,
        childCount: (byParent.get(s.id) ?? []).length,
        subtreeTokens: sub.tokens,
        subtreeCost: sub.cost,
      })
      walk(s.id, [...ancestorHasNext, !isLast])
    })
  }
  walk(null, [])
  return rows
}

const RAIL_WIDTH = 18
const CIRCLE_SIZE = 16

interface TreeViewProps {
  spans: Span[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function TreeView({ spans, selectedId, onSelect }: TreeViewProps) {
  const rows = buildRows(spans)
  return (
    <ul>
      {rows.map((row) => (
        <TreeRow
          key={row.span.id}
          row={row}
          selected={row.span.id === selectedId}
          onSelect={() => onSelect(row.span.id)}
        />
      ))}
    </ul>
  )
}

interface TreeRowProps {
  row: FlatRow
  selected: boolean
  onSelect: () => void
}

function TreeRow({ row, selected, onSelect }: TreeRowProps) {
  const { span, depth, ancestorHasNext, isLastChild, childCount, subtreeTokens, subtreeCost } = row
  const cost = formatCost(subtreeCost)

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'relative flex w-full cursor-pointer items-stretch px-2 py-1 text-left text-[13px]',
          selected ? 'bg-indigo-500/15 dark:bg-indigo-400/15' : 'hover:bg-zinc-100 dark:hover:bg-white/5',
        ].join(' ')}
      >
        <div className="flex shrink-0" aria-hidden>
          {ancestorHasNext.map((hasNext, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rail count is the row depth, fixed for a given span
            <div key={`${span.id}-rail-${i}`} className="relative" style={{ width: RAIL_WIDTH }}>
              {hasNext && (
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-300 dark:bg-zinc-700" />
              )}
            </div>
          ))}

          {depth > 0 && (
            <div className="relative" style={{ width: RAIL_WIDTH }}>
              <div
                className={[
                  'absolute left-1/2 top-0 w-px -translate-x-1/2 bg-zinc-300 dark:bg-zinc-700',
                  isLastChild ? 'h-1/2' : 'h-full',
                ].join(' ')}
              />
              <div className="absolute left-1/2 top-1/2 h-px w-1/2 -translate-y-1/2 bg-zinc-300 dark:bg-zinc-700" />
            </div>
          )}

          <div className="relative" style={{ width: childCount > 0 ? CIRCLE_SIZE + 8 : 0 }}>
            {childCount > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700"
                style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
              >
                {childCount}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium text-rose-500 dark:text-rose-400">{span.service}</span>
            <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {KIND_LETTER[span.kind]}
            </span>
            <span className="truncate text-zinc-900 dark:text-zinc-100">{span.name}</span>
          </div>

          {(subtreeTokens > 0 || cost) && (
            <div className="flex items-center gap-2 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-500">
              {subtreeTokens > 0 && (
                <span>
                  <span className="text-zinc-400 dark:text-zinc-600">Σ</span> {subtreeTokens}
                </span>
              )}
              {cost && (
                <span>
                  <span className="text-zinc-400 dark:text-zinc-600">$</span> {cost}
                </span>
              )}
            </div>
          )}
        </div>
      </button>
    </li>
  )
}
