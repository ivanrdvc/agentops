import { BeakerIcon } from '@heroicons/react/20/solid'
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
      <div className="overflow-hidden rounded-xl border border-zinc-950/5 bg-white dark:border-white/8 dark:bg-zinc-900">
        <EmptyState
          icon={BeakerIcon}
          title="No evals yet"
          description="Evaluation runs and scorecards will appear here once they are configured."
        />
      </div>
    </div>
  )
}
