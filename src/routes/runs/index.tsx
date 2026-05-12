import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'
import {
  Pagination,
  PaginationList,
  PaginationNext,
  PaginationPage,
  PaginationPrevious,
} from '#/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { listRecentTraces, type TraceSummary } from '#/lib/telemetry'
import { MOCK_RUNS, type RunStatus } from './-mock-runs'

const fetchRecentRuns = createServerFn({ method: 'GET' }).handler(async () => {
  return await listRecentTraces({ limit: 50 })
})

export const Route = createFileRoute('/runs/')({
  loader: async () => fetchRecentRuns(),
  component: RunsList,
})

type StatusFilter = 'all' | RunStatus
type SortKey = 'startedAt' | 'agent' | 'costUsd'
type SortDir = 'asc' | 'desc'

interface RunRow {
  id: string
  agent: string
  status: RunStatus
  startedAt: number
  costUsd: number
}

function toRow(t: TraceSummary): RunRow {
  return {
    id: t.id,
    agent: t.agent ?? '—',
    status: t.hasError ? 'error' : 'ok',
    startedAt: t.startedAtMs,
    costUsd: t.totalCostUsd ?? 0,
  }
}

const PAGE_SIZE = 10

function RunsList() {
  const loaderData = Route.useLoaderData()
  const real = loaderData?.traces ?? []
  const usingReal = real.length > 0

  const rows: RunRow[] = usingReal ? real.map(toRow) : MOCK_RUNS

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('startedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [pageIndex, setPageIndex] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (q && !r.agent.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, query, status])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(pageIndex, totalPages - 1)
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'agent' ? 'asc' : 'desc')
    }
  }

  function resetPage() {
    setPageIndex(0)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
        <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">Runs</h1>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{sorted.length}</span>
        {usingReal && loaderData?.provider === 'openobserve' ? (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            via {loaderData.provider} · {loaderData.fingerprint}
          </span>
        ) : !usingReal ? (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            demo data
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              resetPage()
            }}
            placeholder="Search agent or id…"
            className="w-64 rounded-md border border-zinc-950/10 bg-transparent px-2.5 py-1 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950/30 focus:outline-none dark:border-white/10 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white/30"
          />
          <StatusPills
            value={status}
            onChange={(v) => {
              setStatus(v)
              resetPage()
            }}
          />
        </div>
      </div>

      <Table dense>
        <TableHead>
          <TableRow>
            <TableHeader className="w-32">
              <SortButton active={sortKey === 'startedAt'} dir={sortDir} onClick={() => toggleSort('startedAt')}>
                Started
              </SortButton>
            </TableHeader>
            <TableHeader>
              <SortButton active={sortKey === 'agent'} dir={sortDir} onClick={() => toggleSort('agent')}>
                Agent
              </SortButton>
            </TableHeader>
            <TableHeader className="w-32 text-right">
              <SortButton
                active={sortKey === 'costUsd'}
                dir={sortDir}
                onClick={() => toggleSort('costUsd')}
                className="justify-end"
              >
                Cost
              </SortButton>
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {paged.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                No runs match.
              </TableCell>
            </TableRow>
          ) : (
            paged.map((r) => (
              <TableRow key={r.id} href={`/runs/${r.id}`} title={`Run ${r.id}`}>
                <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-2">
                    <StatusDot status={r.status} />
                    {formatAgo(r.startedAt)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-zinc-950 dark:text-white">{r.agent}</span>
                  <span className="ml-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {usingReal ? truncateId(r.id) : `#${r.id}`}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatCost(r.costUsd)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationPrevious onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={safePage === 0} />
          <PaginationList>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationPage
                key={`page-${page}`}
                onClick={() => setPageIndex(page - 1)}
                current={page === safePage + 1}
              >
                {String(page)}
              </PaginationPage>
            ))}
          </PaginationList>
          <PaginationNext
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          />
        </Pagination>
      )}
    </div>
  )
}

function SortButton({
  active,
  dir,
  onClick,
  className,
  children,
}: {
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  const Icon = !active ? ChevronUpDownIcon : dir === 'asc' ? ChevronUpIcon : ChevronDownIcon
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 text-left font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
        className ?? '',
      ].join(' ')}
    >
      {children}
      <Icon
        className={['size-3.5', active ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'].join(
          ' ',
        )}
      />
    </button>
  )
}

function StatusPills({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  const opts: { v: StatusFilter; label: string }[] = [
    { v: 'all', label: 'All' },
    { v: 'ok', label: 'OK' },
    { v: 'error', label: 'Error' },
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

function StatusDot({ status }: { status: RunStatus }) {
  return (
    <span
      role="img"
      aria-label={status}
      className={['inline-block size-1.5 rounded-full', status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'].join(' ')}
    />
  )
}

function formatAgo(startedAtMs: number): string {
  const s = Math.max(0, (Date.now() - startedAtMs) / 1000)
  if (s < 60) return `${Math.round(s)}s ago`
  const m = s / 60
  if (m < 60) return `${Math.round(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

function formatCost(usd: number): string {
  if (usd < 0.0001) return '<$0.0001'
  return `$${usd.toFixed(4)}`
}

function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}
