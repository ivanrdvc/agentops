import { ChatBubbleLeftRightIcon } from '@heroicons/react/20/solid'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { EmptyState } from '#/components/empty-state'
import { SearchInput } from '#/components/search-input'
import { StatusPills } from '#/components/status-pills'
import { TimeRangeSelect } from '#/components/time-range-select'
import { TraceDrawer } from '#/components/trace-drawer'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { formatAgo, formatCost, truncateId } from '#/lib/format'
import type { SessionSummary } from '#/lib/telemetry'
import { parseTimeRangeDays, type TimeRangeDays } from '#/lib/time-range'
import { sessionQuery, sessionsQuery } from './-data'

export const Route = createFileRoute('/sessions/')({
  validateSearch: (search: Record<string, unknown>): SessionsSearch => ({
    days: parseTimeRangeDays(search.days),
    q: typeof search.q === 'string' && search.q.length > 0 ? search.q : undefined,
    status: parseStatusFilter(search.status),
  }),
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(sessionsQuery(deps.days)),
  component: SessionsList,
})

type StatusFilter = 'all' | 'ok' | 'error'
interface SessionsSearch {
  days: TimeRangeDays
  q?: string
  status?: Exclude<StatusFilter, 'all'>
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ok', label: 'OK' },
  { value: 'error', label: 'Error' },
]

function formatTokens(tokens: number | undefined): string {
  if (!tokens) return '—'
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 10_000) return `${Math.round(tokens / 1000)}k`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toLocaleString()
}

function parseStatusFilter(value: unknown): Exclude<StatusFilter, 'all'> | undefined {
  return value === 'ok' || value === 'error' ? value : undefined
}

function metricTone(kind: 'cost' | 'tokens', value: number | undefined): string {
  if (!value) return 'text-zinc-500 dark:text-zinc-400'
  if (kind === 'cost') {
    if (value >= 1) return 'text-rose-700 dark:text-rose-300'
    if (value >= 0.1) return 'text-amber-700 dark:text-amber-300'
  }
  if (kind === 'tokens') {
    if (value >= 100_000) return 'text-rose-700 dark:text-rose-300'
    if (value >= 32_000) return 'text-amber-700 dark:text-amber-300'
  }
  return 'text-zinc-950 dark:text-white'
}

function userParts(s: SessionSummary): { primary: string; secondary?: string } {
  if (s.userName) return { primary: s.userName, secondary: s.userId ?? s.host }
  if (s.userId) return { primary: s.userId, secondary: s.host }
  if (s.host) return { primary: s.host }
  return { primary: '—' }
}

function SessionsList() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: loaderData } = useQuery(sessionsQuery(search.days))
  const sessions: SessionSummary[] = loaderData?.sessions ?? []

  const query = search.q ?? ''
  const status = search.status ?? 'all'
  const [traceSessionId, setTraceSessionId] = useState<string | null>(null)

  const setQuery = (nextQuery: string) => {
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, q: nextQuery || undefined }),
    })
  }

  const setStatus = (nextStatus: StatusFilter) => {
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, status: nextStatus === 'all' ? undefined : nextStatus }),
    })
  }

  const setDays = (days: TimeRangeDays) => {
    navigate({
      search: (prev) => ({ ...prev, days }),
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions.filter((s) => {
      const hasError = !!s.hasError
      if (status === 'ok' && hasError) return false
      if (status === 'error' && !hasError) return false
      if (q) {
        const agents = s.agents.join(' ').toLowerCase()
        const title = s.title?.toLowerCase() ?? ''
        const user = [s.userName, s.userId, s.host].filter(Boolean).join(' ').toLowerCase()
        if (!agents.includes(q) && !s.sessionId.toLowerCase().includes(q) && !title.includes(q) && !user.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [sessions, query, status])

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Sessions</h1>
        {loaderData?.provider === 'openobserve' && (
          <span title={loaderData.fingerprint} className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
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
            <TimeRangeSelect value={search.days} onChange={setDays} />
            <StatusPills value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
        )}
      </header>

      {sessions.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-950/5 bg-white dark:border-white/8 dark:bg-zinc-900">
          <EmptyState
            icon={ChatBubbleLeftRightIcon}
            title="No sessions yet"
            description={
              <>
                Emit{' '}
                <code className="rounded bg-zinc-950/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-white/[0.08] dark:text-zinc-200">
                  session.id
                </code>{' '}
                on spans, or use{' '}
                <code className="rounded bg-zinc-950/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-white/[0.08] dark:text-zinc-200">
                  invoke_agent Name(hex)
                </code>{' '}
                naming so rows can be derived.
              </>
            }
          />
        </div>
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">Trace</TableHeader>
              <TableHeader>Session</TableHeader>
              <TableHeader className="w-40">User</TableHeader>
              <TableHeader className="w-28 text-right">Cost</TableHeader>
              <TableHeader className="w-20 text-right">Turns</TableHeader>
              <TableHeader className="w-24 text-right">Tokens</TableHeader>
              <TableHeader className="w-44">Agent</TableHeader>
              <TableHeader className="w-20">Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No sessions match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <SessionRow
                  key={s.sessionId}
                  session={s}
                  days={search.days}
                  onOpenTrace={() => setTraceSessionId(s.sessionId)}
                />
              ))
            )}
          </TableBody>
        </Table>
      )}

      {traceSessionId && (
        <TraceDrawerForSession sessionId={traceSessionId} days={search.days} onClose={() => setTraceSessionId(null)} />
      )}
    </div>
  )
}

function TraceDrawerForSession({
  sessionId,
  days,
  onClose,
}: {
  sessionId: string
  days: TimeRangeDays
  onClose: () => void
}) {
  const { data, isLoading } = useQuery(sessionQuery(sessionId, days))
  return (
    <TraceDrawer open onClose={onClose} spans={data?.spans ?? []} loading={isLoading} title={truncateId(sessionId)} />
  )
}

function SessionRow({
  session: s,
  days,
  onOpenTrace,
}: {
  session: SessionSummary
  days: TimeRangeDays
  onOpenTrace: () => void
}) {
  const label = `Open session ${s.sessionId}`
  const sessionTitle = s.title?.trim()
  const title = sessionTitle || truncateId(s.sessionId)
  const agentLabel = s.agents.length > 0 ? s.agents.join(', ') : '—'
  const user = userParts(s)

  return (
    <TableRow href={`/sessions/${s.sessionId}`} search={days === 1 ? undefined : { days }} title={label}>
      <TableCell>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onOpenTrace()
          }}
          className="relative z-10 inline-flex h-6 items-center rounded-md border border-zinc-950/10 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          View
        </button>
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium text-zinc-950 dark:text-white">{title}</span>
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            <time dateTime={new Date(s.lastSeenMs).toISOString()}>{formatAgo(s.lastSeenMs)}</time>
            {sessionTitle && (
              <>
                {' '}
                · <span className="font-mono">{truncateId(s.sessionId)}</span>
              </>
            )}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-zinc-950 dark:text-white">{user.primary}</span>
          {user.secondary && (
            <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.secondary}</span>
          )}
        </div>
      </TableCell>
      <TableCell className={`text-right font-medium tabular-nums ${metricTone('cost', s.totalCostUsd)}`}>
        {formatCost(s.totalCostUsd ?? 0)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">{s.traceCount}</TableCell>
      <TableCell className={`text-right font-medium tabular-nums ${metricTone('tokens', s.totalTokens)}`}>
        {formatTokens(s.totalTokens)}
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-accent-600 dark:text-accent-400">{agentLabel}</span>
          {s.source === 'agent-instance' && (
            <span
              title="Derived from agent-instance hex in span names (no session.id attribute)"
              className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300"
            >
              heuristic
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {s.hasError ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-300">
            <span className="size-1.5 rounded-full bg-rose-500" />
            Error
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">OK</span>
        )}
      </TableCell>
    </TableRow>
  )
}
