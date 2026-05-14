import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { queryKeys, STALE_TELEMETRY_MS } from '#/lib/query-keys'
import { getSession, listRecentSessions } from '#/lib/telemetry'
import { parseTimeRangeDays, type TimeRangeDays, timeRangeWindow } from '#/lib/time-range'

const fetchSessions = createServerFn({ method: 'GET' })
  .inputValidator(parseTimeRangeDays)
  .handler(async ({ data }) => {
    return await listRecentSessions({ limit: 50, ...timeRangeWindow(data) })
  })

const fetchSession = createServerFn({ method: 'GET' })
  .inputValidator((input: { sessionId: string; days?: unknown }) => ({
    sessionId: input.sessionId,
    days: parseTimeRangeDays(input.days),
  }))
  .handler(async ({ data }) => {
    return await getSession(data.sessionId, timeRangeWindow(data.days))
  })

export const sessionsQuery = (days: TimeRangeDays = 1) =>
  queryOptions({
    queryKey: queryKeys.sessions.window(days),
    queryFn: () => fetchSessions({ data: days }),
    staleTime: STALE_TELEMETRY_MS,
  })

export const sessionQuery = (id: string, days: TimeRangeDays = 1) =>
  queryOptions({
    queryKey: queryKeys.sessions.detailWindow(id, days),
    queryFn: () => fetchSession({ data: { sessionId: id, days } }),
    staleTime: STALE_TELEMETRY_MS,
  })
