import { ChevronLeftIcon } from '@heroicons/react/16/solid'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ConversationView } from '#/components/conversation-view'
import { Link } from '#/components/ui/link'
import { getSession } from '#/lib/telemetry'

const fetchSession = createServerFn({ method: 'GET' })
  .inputValidator((sessionId: string) => sessionId)
  .handler(async ({ data }) => {
    return await getSession(data)
  })

export const Route = createFileRoute('/sessions/$sessionId')({
  loader: async ({ params }) => fetchSession({ data: params.sessionId }),
  component: SessionDetail,
})

function SessionDetail() {
  const { sessionId } = Route.useParams()
  const data = Route.useLoaderData()

  if (!data) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col">
        <Header sessionId={sessionId} source={null} traceCount={0} provider={undefined} fingerprint={undefined} />
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
          Session not found. Check that traces with this session.id exist in the active provider.
        </div>
      </div>
    )
  }

  const { spans, traceIds, source, provider, fingerprint } = data

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <Header
        sessionId={sessionId}
        source={source}
        traceCount={traceIds.length}
        provider={provider}
        fingerprint={fingerprint}
      />

      <div className="flex min-h-0 flex-1 border-t border-zinc-950/10 dark:border-white/10">
        <section className="flex min-w-0 flex-1 flex-col overflow-auto">
          {/* onSelect is a no-op until a detail panel exists on the session page. */}
          <ConversationView spans={spans} onSelect={() => {}} />
        </section>
      </div>
    </div>
  )
}

interface HeaderProps {
  sessionId: string
  source: 'attribute' | 'agent-instance' | null
  traceCount: number
  provider?: string
  fingerprint?: string
}

function Header({ sessionId, source, traceCount, provider, fingerprint }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3">
      <Link
        href="/sessions"
        aria-label="Back to sessions"
        className="-ml-1 inline-flex size-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4 fill-current" />
      </Link>
      <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">Session</h1>
      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{sessionId}</span>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        · {traceCount} run{traceCount === 1 ? '' : 's'}
      </div>
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
    </header>
  )
}
