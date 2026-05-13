import { ChatBubbleLeftRightIcon } from '@heroicons/react/20/solid'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { EmptyState } from '#/components/empty-state'
import { SearchInput } from '#/components/search-input'
import { StatusDot } from '#/components/status-dot'
import { StatusPills } from '#/components/status-pills'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { formatAgo, formatCost, truncateId } from '#/lib/format'
import type { SessionSummary } from '#/lib/telemetry'
import { sessionsQuery } from './-data'

export const Route = createFileRoute('/sessions/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionsQuery()),
  component: SessionsList,
})

type StatusFilter = 'all' | 'ok' | 'error'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ok', label: 'OK' },
  { value: 'error', label: 'Error' },
]

function SessionsList() {
  const { data: loaderData } = useQuery(sessionsQuery())
  const sessions: SessionSummary[] = loaderData?.sessions ?? []

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions.filter((s) => {
      const hasError = !!s.hasError
      if (status === 'ok' && hasError) return false
      if (status === 'error' && !hasError) return false
      if (q) {
        const agents = s.agents.join(' ').toLowerCase()
        if (!agents.includes(q) && !s.sessionId.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [sessions, query, status])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Sessions</h1>
        {loaderData?.provider === 'openobserve' && (
          <span
            title={loaderData.fingerprint}
            className="text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            via {loaderData.provider}
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
        {sessions.length > 0 && (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
            <SearchInput value={query} onChange={setQuery} placeholder="Search agent or id…" />
            <StatusPills value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-950/5 bg-white dark:border-white/8 dark:bg-zinc-900">
          <EmptyState
            icon={ChatBubbleLeftRightIcon}
            title="No sessions yet"
            description={
              <>
                Spans need a{' '}
                <code className="rounded bg-zinc-950/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/5">
                  session.id
                </code>{' '}
                attribute, or an{' '}
                <code className="rounded bg-zinc-950/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/5">
                  invoke_agent Name(hex)
                </code>{' '}
                span name as fallback. If your emitter writes neither, nothing shows up here.
              </>
            }
          />
        </div>
      ) : (
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No sessions match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.sessionId} href={`/sessions/${s.sessionId}`} title={`Session ${s.sessionId}`}>
                  <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-2">
                      <StatusDot hasError={!!s.hasError} />
                      {formatAgo(s.lastSeenMs)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-accent-600 dark:text-accent-400">
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
      )}
    </div>
  )
}
