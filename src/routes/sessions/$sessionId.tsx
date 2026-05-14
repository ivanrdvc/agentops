import { ChevronLeftIcon } from '@heroicons/react/16/solid'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  AUTO_REFRESH_MS,
  type AutoRefreshInterval,
  AutoRefreshSelect,
  DEFAULT_AUTO_REFRESH_INTERVAL,
} from '#/components/auto-refresh-select'
import { ContextWindow } from '#/components/context-window'
import { ConversationView } from '#/components/conversation-view'
import { TimeRangeSelect } from '#/components/time-range-select'
import { TraceInspectLayout } from '#/components/trace-drawer'
import { Link } from '#/components/ui/link'
import type { Span } from '#/lib/spans'
import { DEFAULT_TIME_RANGE_DAYS, parseTimeRangeDays, type TimeRangeDays } from '#/lib/time-range'
import { sessionQuery } from './-data'

export const Route = createFileRoute('/sessions/$sessionId')({
  validateSearch: (search: Record<string, unknown>): SessionSearch => ({
    days: parseTimeRangeDays(search.days),
    view: parseSessionView(search.view) ?? 'conversation',
    span: parseSpanParam(search.span),
  }),
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: ({ context, params, deps }) => context.queryClient.ensureQueryData(sessionQuery(params.sessionId, deps.days)),
  component: SessionDetail,
})

interface SessionSearch {
  days: TimeRangeDays
  view: 'trace' | 'conversation'
  span?: string
}

function parseSessionView(value: unknown): 'trace' | 'conversation' | undefined {
  if (value === 'trace' || value === 'conversation') return value
  return undefined
}

function parseSpanParam(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function SessionDetail() {
  const { sessionId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [autoRefresh, setAutoRefresh] = useState(DEFAULT_AUTO_REFRESH_INTERVAL)
  const { data, refetch, isFetching } = useQuery({
    ...sessionQuery(sessionId, search.days),
    refetchInterval: AUTO_REFRESH_MS[autoRefresh],
  })
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    search.view === 'trace' && search.span ? search.span : null,
  )

  useEffect(() => {
    setSelectedId(search.view === 'trace' && search.span ? search.span : null)
  }, [search.view, search.span])

  const setDays = (days: TimeRangeDays) => {
    navigate({
      search: (prev) => ({ ...prev, days }),
    })
  }

  if (!data) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col">
        <Header source={null} provider={undefined} fingerprint={undefined} days={search.days} onDaysChange={setDays} />
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
          Session not found. Check that traces with this session.id exist in the active provider.
        </div>
      </div>
    )
  }

  const { spans, source, provider, fingerprint } = data
  const inspectView = search.view
  const setInspectView = (view: 'trace' | 'conversation') => {
    navigate({
      search: (prev) => {
        if (view === 'conversation') {
          return { days: prev.days, view: 'conversation' }
        }
        return {
          days: prev.days,
          view: 'trace',
          ...(typeof prev.span === 'string' && prev.span.length > 0 ? { span: prev.span } : {}),
        }
      },
    })
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <Header
        source={source}
        provider={provider}
        fingerprint={fingerprint}
        spans={spans}
        days={search.days}
        onDaysChange={setDays}
        showTimeRange={false}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        onRefresh={() => {
          void refetch()
        }}
        refreshing={isFetching}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-950/10 dark:border-white/10">
        <SessionInspectTabs active={inspectView} onSelect={setInspectView} />
        <div className="min-h-0 flex-1 overflow-hidden bg-white dark:bg-zinc-900">
          {inspectView === 'trace' ? (
            <TraceInspectLayout spans={spans} loading={false} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <ConversationView spans={spans} onSelect={setSelectedId} />
          )}
        </div>
      </div>
    </div>
  )
}

function SessionInspectTabs({
  active,
  onSelect,
}: {
  active: 'trace' | 'conversation'
  onSelect: (view: 'trace' | 'conversation') => void
}) {
  return (
    <nav
      className="flex shrink-0 flex-wrap gap-5 border-zinc-950/10 border-b bg-white px-3 pt-3 pb-0 dark:border-white/10 dark:bg-zinc-900"
      aria-label="Session view"
    >
      <button
        type="button"
        onClick={() => onSelect('trace')}
        className={[
          '-mb-px border-b-2 pb-1.5 text-xs font-medium transition-colors',
          active === 'trace'
            ? 'border-accent-500 text-zinc-950 dark:border-accent-400 dark:text-white'
            : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
        ].join(' ')}
      >
        Trace
      </button>
      <button
        type="button"
        onClick={() => onSelect('conversation')}
        className={[
          '-mb-px border-b-2 pb-1.5 text-xs font-medium transition-colors',
          active === 'conversation'
            ? 'border-accent-500 text-zinc-950 dark:border-accent-400 dark:text-white'
            : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
        ].join(' ')}
      >
        Conversation
      </button>
    </nav>
  )
}

interface HeaderProps {
  source: 'attribute' | 'agent-instance' | null
  provider?: string
  fingerprint?: string
  spans?: Span[]
  days?: TimeRangeDays
  onDaysChange?: (days: TimeRangeDays) => void
  /** Hide time window control (e.g. trace / conversation full-width inspect mode). */
  showTimeRange?: boolean
  autoRefresh?: AutoRefreshInterval
  onAutoRefreshChange?: (value: AutoRefreshInterval) => void
  onRefresh?: () => void
  refreshing?: boolean
}

function Header({
  source,
  provider,
  fingerprint,
  spans,
  days,
  onDaysChange,
  showTimeRange = true,
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  refreshing,
}: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
      <Link
        href="/sessions"
        search={days && days !== DEFAULT_TIME_RANGE_DAYS ? { days } : undefined}
        aria-label="Back to sessions"
        className="-ml-1 inline-flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4 fill-current" />
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Session</h1>
      {spans && spans.length > 0 && <ContextWindow spans={spans} />}
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
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
        {days && onDaysChange && showTimeRange ? <TimeRangeSelect value={days} onChange={onDaysChange} /> : null}
        {autoRefresh && onAutoRefreshChange && onRefresh ? (
          <AutoRefreshSelect
            value={autoRefresh}
            onChange={onAutoRefreshChange}
            onRefresh={onRefresh}
            loading={refreshing}
          />
        ) : null}
      </div>
    </header>
  )
}
