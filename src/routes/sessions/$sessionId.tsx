import { ChevronLeftIcon } from '@heroicons/react/16/solid'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ContextWindow } from '#/components/context-window'
import { ConversationView } from '#/components/conversation-view'
import { TreeView } from '#/components/tree-view'
import { TurnsView } from '#/components/turns-view'
import { Link } from '#/components/ui/link'
import type { Span } from '#/lib/spans'
import { sessionQuery } from './-data'

export const Route = createFileRoute('/sessions/$sessionId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sessionQuery(params.sessionId)),
  component: SessionDetail,
})

type ViewMode = 'spans' | 'conversation'

function SessionDetail() {
  const { sessionId } = Route.useParams()
  const { data } = useQuery(sessionQuery(sessionId))
  const [view, setView] = useState<ViewMode>('conversation')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!data) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col">
        <Header source={null} provider={undefined} fingerprint={undefined} />
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
          Session not found. Check that traces with this session.id exist in the active provider.
        </div>
      </div>
    )
  }

  const { spans, source, provider, fingerprint } = data

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <Header
        source={source}
        provider={provider}
        fingerprint={fingerprint}
        view={view}
        onViewChange={setView}
        spans={spans}
      />

      <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-950/10 md:flex-row dark:border-white/10">
        {/* Explicit md:w-2/5 + md:flex-none locks the turns column at 40% so
            content (e.g. token breakdown numbers arriving async) can't expand
            it and push the conversation column rightward. */}
        <section className="flex min-h-64 min-w-0 flex-1 flex-col border-b border-zinc-950/10 md:w-2/5 md:flex-none md:border-r md:border-b-0 dark:border-white/10">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {view === 'spans' ? 'Operation Name' : 'Turns'}
          </div>
          <div className="flex-1 overflow-auto">
            {view === 'spans' ? (
              <TreeView spans={spans} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <TurnsView spans={spans} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>
        </section>

        <section className="flex min-h-64 min-w-0 flex-1 flex-col md:min-h-0">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {view === 'spans' ? 'Detail' : 'Conversation'}
          </div>
          <div className="min-h-0 flex-1">
            {view === 'spans' ? (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
                Select a span
              </div>
            ) : (
              <ConversationView spans={spans} onSelect={setSelectedId} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

interface HeaderProps {
  source: 'attribute' | 'agent-instance' | null
  provider?: string
  fingerprint?: string
  view?: ViewMode
  onViewChange?: (v: ViewMode) => void
  spans?: Span[]
}

function Header({ source, provider, fingerprint, view, onViewChange, spans }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3">
      <Link
        href="/sessions"
        aria-label="Back to sessions"
        className="-ml-1 inline-flex size-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4 fill-current" />
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Session</h1>
      {spans && view === 'conversation' && <ContextWindow spans={spans} />}
      {source === 'agent-instance' && (
        <span
          title="Derived from the agent-instance hex in span names; no session.id attribute present."
          className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
        >
          heuristic id
        </span>
      )}
      {provider === 'openobserve' && (
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          via {provider} · {fingerprint}
        </span>
      )}
      {view && onViewChange && (
        <div className="w-full sm:ml-auto sm:w-auto">
          <ViewToggle value={view} onChange={onViewChange} />
        </div>
      )}
    </header>
  )
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { v: ViewMode; label: string }[] = [
    { v: 'conversation', label: 'Conversation' },
    { v: 'spans', label: 'Spans' },
  ]
  return (
    <div className="inline-flex w-full rounded-md border border-zinc-950/10 p-0.5 text-xs sm:w-auto dark:border-white/10">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={[
            'flex-1 rounded px-2.5 py-0.5 font-medium transition-colors sm:flex-none',
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
