import { BeakerIcon } from '@heroicons/react/24/outline'
import { createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '#/components/empty-state'

export const Route = createFileRoute('/evals/')({
  component: EvalsPage,
})

function EvalsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Evals</h1>
      </div>
      <EmptyState
        icon={BeakerIcon}
        title="No evals yet"
        description={
          <>
            Push results to{' '}
            <code className="rounded bg-zinc-950/5 px-1 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
              POST /api/evals/ingest
            </code>{' '}
            from your CI, SDK, or GitHub Action.
          </>
        }
      />
    </div>
  )
}
