import { createFileRoute, Link } from '@tanstack/react-router'
import { RUN_SPANS } from './-data'

export const Route = createFileRoute('/runs/')({ component: RunsList })

// Stand-in: a single run derived from the fixture, until ingest + loader land.
const placeholderRuns = [
  {
    id: '4821',
    name: 'proverbs-agent',
    spans: RUN_SPANS.length,
    durationMs: Math.max(...RUN_SPANS.map((s) => s.endMs)) - Math.min(...RUN_SPANS.map((s) => s.startMs)),
  },
]

function RunsList() {
  return (
    <div className="flex h-full flex-col">
      <header className="pb-3">
        <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">Runs</h1>
      </header>

      <ul className="divide-y divide-zinc-950/5 border-t border-zinc-950/10 dark:divide-white/5 dark:border-white/10">
        {placeholderRuns.map((r) => (
          <li key={r.id}>
            <Link
              to="/runs/$runId"
              params={{ runId: r.id }}
              className="flex items-center gap-3 px-2 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <span className="font-medium text-zinc-950 dark:text-white">#{r.id}</span>
              <span className="text-zinc-500 dark:text-zinc-400">{r.name}</span>
              <span className="ml-auto tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                {(r.durationMs / 1000).toFixed(2)}s · {r.spans} spans
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
