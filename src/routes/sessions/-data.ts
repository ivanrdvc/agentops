import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { queryKeys, STALE_TELEMETRY_MS } from '#/lib/query-keys'
import { getSession, listRecentSessions } from '#/lib/telemetry'

const fetchSessions = createServerFn({ method: 'GET' }).handler(async () => {
  return await listRecentSessions({ limit: 50 })
})

const fetchSession = createServerFn({ method: 'GET' })
  .inputValidator((sessionId: string) => sessionId)
  .handler(async ({ data }) => {
    return await getSession(data)
  })

export const sessionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.sessions.all(),
    queryFn: () => fetchSessions(),
    staleTime: STALE_TELEMETRY_MS,
  })

export const sessionQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.sessions.detail(id),
    queryFn: () => fetchSession({ data: id }),
    staleTime: STALE_TELEMETRY_MS,
  })
