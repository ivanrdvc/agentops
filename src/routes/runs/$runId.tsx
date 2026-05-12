import { ChevronLeftIcon } from '@heroicons/react/16/solid'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ConversationView } from '#/components/conversation-view'
import { Link } from '#/components/ui/link'
import type { Span } from '#/lib/spans'
import { getTrace } from '#/lib/telemetry'
import { RUN_SPANS } from './-data'
import { TreeView } from './-tree-view'
import { TurnsView } from './-turns-view'

const fetchTrace = createServerFn({ method: 'GET' })
  .inputValidator((traceId: string) => traceId)
  .handler(async ({ data }) => {
    return await getTrace(data)
  })

export const Route = createFileRoute('/runs/$runId')({
  loader: async ({ params }) => fetchTrace({ data: params.runId }),
  component: RunDetail,
})

type ViewMode = 'spans' | 'turns' | 'conversation'

function RunDetail() {
  const { runId } = Route.useParams()
  const loaderData = Route.useLoaderData()

  // No provider had this trace -> fall back to hardcoded demo data so the page
  // still renders for unknown / fake run IDs (sidebar links to /runs/4821).
  const spans: Span[] = loaderData?.spans ?? RUN_SPANS
  const provider = loaderData?.provider
  const fingerprint = loaderData?.fingerprint
  const truncated = loaderData?.truncated

  const [view, setView] = useState<ViewMode>('spans')
  const [selectedId, setSelectedId] = useState<string | null>(spans[0]?.id ?? null)

  const total = Math.max(...spans.map((s) => s.endMs)) - Math.min(...spans.map((s) => s.startMs))

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3">
        <Link
          href="/runs"
          aria-label="Back to runs"
          className="-ml-1 inline-flex size-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <ChevronLeftIcon className="size-4 fill-current" />
        </Link>
        <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">Run #{runId}</h1>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {spans[0]?.service ?? '—'} · {(total / 1000).toFixed(2)}s · {spans.length} spans
        </div>
        {provider === 'openobserve' ? (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            via {provider} · {fingerprint}
          </span>
        ) : !provider ? (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            demo data
          </span>
        ) : null}
        {truncated && (
          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
            truncated
          </span>
        )}
        <div className="ml-auto">
          <ViewToggle value={view} onChange={setView} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 border-t border-zinc-950/10 dark:border-white/10">
        <section className="flex min-w-0 flex-1 flex-col border-r border-zinc-950/10 dark:border-white/10">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {view === 'spans' ? 'Operation Name' : view === 'turns' ? 'Turns' : 'Conversation'}
          </div>
          <div className="flex-1 overflow-auto">
            {view === 'spans' && <TreeView spans={spans} selectedId={selectedId} onSelect={setSelectedId} />}
            {view === 'turns' && <TurnsView spans={spans} selectedId={selectedId} onSelect={setSelectedId} />}
            {view === 'conversation' && <ConversationView spans={spans} onSelect={setSelectedId} />}
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
    { v: 'conversation', label: 'Conversation' },
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
