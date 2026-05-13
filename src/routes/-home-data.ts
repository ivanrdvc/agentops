import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { queryKeys, STALE_TELEMETRY_MS } from '#/lib/query-keys'
import { runDetection } from '#/server/detection'
import { listHomeInventory } from '#/server/inbox'

const fetchHome = createServerFn({ method: 'GET' }).handler(async () => {
  await Promise.allSettled([runDetection('new_tool'), runDetection('new_agent')])
  return await listHomeInventory()
})

export const homeQuery = () =>
  queryOptions({
    queryKey: queryKeys.home.all(),
    queryFn: () => fetchHome(),
    staleTime: STALE_TELEMETRY_MS,
    refetchInterval: STALE_TELEMETRY_MS,
  })
