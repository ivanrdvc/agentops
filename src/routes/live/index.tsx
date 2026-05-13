import { PlayCircleIcon } from '@heroicons/react/20/solid'
import { createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '#/components/empty-state'

export const Route = createFileRoute('/live/')({
  component: LiveLanding,
})

function LiveLanding() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Live</h1>
      </div>
      <EmptyState
        icon={PlayCircleIcon}
        title="Nothing live yet"
        description={
          <>
            This page is for runs that are still in motion — live-tailing spans as they flush from the
            exporter, streaming events from a running app, or initiating a run against a configured agent.
            Finished runs live under{' '}
            <a href="/sessions" className="font-medium text-accent-600 hover:underline dark:text-accent-400">
              Sessions
            </a>
            .
          </>
        }
      />
    </div>
  )
}
