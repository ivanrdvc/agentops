import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { listRecentSessions, type SessionSummary } from '#/lib/telemetry'

const fetchRecentSessions = createServerFn({ method: 'GET' }).handler(async () => {
  return await listRecentSessions({ limit: 50 })
})

export const Route = createFileRoute('/sessions/')({
  loader: async () => fetchRecentSessions(),
  component: SessionsList,
})

function SessionsList() {
  const loaderData = Route.useLoaderData()
  const sessions: SessionSummary[] = loaderData?.sessions ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
        <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">Sessions</h1>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{sessions.length}</span>
        {loaderData?.provider === 'openobserve' && (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            via {loaderData.provider} · {loaderData.fingerprint}
          </span>
        )}
        {loaderData?.truncated && (
          <span
            title="Scan hit its row cap; older sessions may be missing. Narrow the time range to see them."
            className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300"
          >
            truncated
          </span>
        )}
      </div>

      <Table dense>
        <TableHead>
          <TableRow>
            <TableHeader className="w-32">Last seen</TableHeader>
            <TableHeader>Agent</TableHeader>
            <TableHeader className="w-20 text-right">Runs</TableHeader>
            <TableHeader className="w-32 text-right">Cost</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                No sessions found.
                <div className="mt-2 text-[11px]">
                  Spans need a `session.id` attribute (OTel GenAI semconv) to group into sessions.
                  Without it the agent-instance hex from <code>invoke_agent Name(hex)</code> span names is
                  used as a fallback — if your emitter writes neither, no sessions appear here.
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((s) => (
              <TableRow key={s.sessionId} href={`/sessions/${s.sessionId}`} title={`Session ${s.sessionId}`}>
                <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-2">
                    <StatusDot hasError={!!s.hasError} />
                    {formatAgo(s.lastSeenMs)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-950 dark:text-white">
                      {s.agents.length > 0 ? s.agents.join(', ') : '—'}
                    </span>
                    {s.source === 'agent-instance' && (
                      <span
                        title="Derived from agent-instance hex in span names (no session.id attribute)"
                        className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300"
                      >
                        heuristic
                      </span>
                    )}
                    <span className="ml-auto font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {truncateId(s.sessionId)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {s.traceCount}
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatCost(s.totalCostUsd ?? 0)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function StatusDot({ hasError }: { hasError: boolean }) {
  return (
    <span
      role="img"
      aria-label={hasError ? 'error' : 'ok'}
      className={['inline-block size-1.5 rounded-full', hasError ? 'bg-rose-500' : 'bg-emerald-500'].join(' ')}
    />
  )
}

function formatAgo(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 60) return `${Math.round(s)}s ago`
  const m = s / 60
  if (m < 60) return `${Math.round(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

function formatCost(usd: number): string {
  if (!usd) return '—'
  if (usd < 0.0001) return '<$0.0001'
  return `$${usd.toFixed(4)}`
}

function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}
