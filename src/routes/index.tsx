import {
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CubeTransparentIcon,
  ExclamationTriangleIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/20/solid'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { EmptyState } from '#/components/empty-state'
import { TimeRangeSelect } from '#/components/time-range-select'
import { Link } from '#/components/ui/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { formatAgo } from '#/lib/format'
import { HOME_RANGE_DAYS, type HomeRangeDays, homeQuery, parseHomeRangeDays } from './-home-data'

interface HomeSearch {
  days?: HomeRangeDays
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    days: search.days == null ? undefined : parseHomeRangeDays(search.days),
  }),
  loaderDeps: ({ search }) => ({ days: search.days ?? 7 }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(homeQuery(deps.days)),
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const days = search.days ?? 7
  const { data } = useQuery(homeQuery(days))
  const newTools = data?.newTools ?? []
  const newAgents = data?.newAgents ?? []
  const inventorySubtitle = days === 1 ? 'First seen in the last 24h' : `First seen in the last ${days} days`

  const setDays = (days: HomeRangeDays) => {
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, days: days === 7 ? undefined : days }),
    })
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Home</h1>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            What's new and what's weird across your agent fleet
          </span>
        </div>

        <TimeRangeSelect value={days} onChange={setDays} options={HOME_RANGE_DAYS} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section icon={CubeTransparentIcon} title="New MCP tools" subtitle={inventorySubtitle}>
          {newTools.length === 0 ? (
            <SectionEmpty label="No newly observed MCP tools." />
          ) : (
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Tool</TableHeader>
                  <TableHeader>Server</TableHeader>
                  <TableHeader>First seen</TableHeader>
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {newTools.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.name}</TableCell>
                    <TableCell className="text-zinc-500 dark:text-zinc-400">{row.namespace || 'unknown'}</TableCell>
                    <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatAgo(row.firstSeenAtMs)}
                    </TableCell>
                    <TableCell>
                      <OpenLink href={row.firstSeenTraceId ? `/live/${row.firstSeenTraceId}` : '/sessions'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section
          icon={BoltIcon}
          title="New agents"
          subtitle={`Agent names observed for the first time, ${days === 1 ? 'last 24h' : `last ${days} days`}`}
        >
          {newAgents.length === 0 ? (
            <SectionEmpty label="No newly observed agents." />
          ) : (
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Agent</TableHeader>
                  <TableHeader>First seen</TableHeader>
                  <TableHeader>Last seen</TableHeader>
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {newAgents.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatAgo(row.firstSeenAtMs)}
                    </TableCell>
                    <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatAgo(row.lastSeenAtMs)}
                    </TableCell>
                    <TableCell>
                      <OpenLink href={row.firstSeenTraceId ? `/live/${row.firstSeenTraceId}` : '/sessions'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section icon={InboxArrowDownIcon} title="Tools returning too much" subtitle="Top response sizes in last 24h">
          <EmptyState
            icon={InboxArrowDownIcon}
            title="No size anomalies yet"
            description="No open payload-size alerts."
          />
        </Section>

        <Section
          icon={ExclamationTriangleIcon}
          title="Tools with high error rate"
          subtitle="Top error rates in last 24h"
        >
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="No error-rate anomalies yet"
            description="No open tool error-rate alerts."
          />
        </Section>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="group/section rounded-xl border border-zinc-950/5 bg-white p-5 transition-colors duration-150 hover:border-zinc-950/10 dark:border-white/8 dark:bg-zinc-900 dark:hover:border-white/12">
      <div className="flex items-center gap-2 pb-3">
        <Icon className="size-4 fill-accent-500 transition-colors duration-150 dark:fill-accent-400" />
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
      </div>
      {children}
    </section>
  )
}

function SectionEmpty({ label }: { label: string }) {
  return <div className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
}

function OpenLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      aria-label="Open"
    >
      <ArrowTopRightOnSquareIcon className="size-3.5" />
    </Link>
  )
}
