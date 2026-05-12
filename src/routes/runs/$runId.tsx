import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { RUN_SPANS } from './-data'
import { TreeView } from './-tree-view'
import { TurnsView } from './-turns-view'

export const Route = createFileRoute('/runs/$runId')({ component: RunDetail })

type ViewMode = 'spans' | 'turns'

function RunDetail() {
  const { runId } = Route.useParams()
  const [view, setView] = useState<ViewMode>('spans')
  const [selectedId, setSelectedId] = useState<string | null>(RUN_SPANS[0]?.id ?? null)

  const total = Math.max(...RUN_SPANS.map((s) => s.endMs)) - Math.min(...RUN_SPANS.map((s) => s.startMs))

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <header className="flex items-center gap-3 pb-3">
        <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">Run #{runId}</h1>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          proverbs-agent · {(total / 1000).toFixed(2)}s · {RUN_SPANS.length} spans
        </div>
        <div className="ml-auto">
          <ViewToggle value={view} onChange={setView} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 border-t border-zinc-950/10 dark:border-white/10">
        <section className="flex min-w-0 flex-1 flex-col border-r border-zinc-950/10 dark:border-white/10">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {view === 'spans' ? 'Operation Name' : 'Turns'}
          </div>
          <div className="flex-1 overflow-auto">
            {view === 'spans' ? (
              <TreeView spans={RUN_SPANS} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <TurnsView spans={RUN_SPANS} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-[1.3] flex-col">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Detail</div>
          <div className="flex flex-1 items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
            Select a span
          </div>
        </section>
      </div>
    </div>
  )
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { v: ViewMode; label: string }[] = [
    { v: 'spans', label: 'Spans' },
    { v: 'turns', label: 'Turns' },
  ]
  return (
    <div className="inline-flex rounded-md border border-zinc-950/10 p-0.5 text-xs dark:border-white/10">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={[
            'rounded px-2.5 py-0.5 font-medium transition-colors',
            value === o.v
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
