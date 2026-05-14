export const TIME_RANGE_DAYS = [1, 7, 14, 30] as const
export type TimeRangeDays = (typeof TIME_RANGE_DAYS)[number]

export function parseTimeRangeDays(value: unknown, fallback: TimeRangeDays = 1): TimeRangeDays {
  const days = typeof value === 'string' ? Number(value) : value
  return TIME_RANGE_DAYS.includes(days as TimeRangeDays) ? (days as TimeRangeDays) : fallback
}

export function timeRangeLabel(days: TimeRangeDays) {
  return days === 1 ? 'Past 1 day' : `Past ${days} days`
}

export function timeRangeShortcut(days: TimeRangeDays) {
  return `${days}d`
}

export function timeRangeWindow(days: TimeRangeDays) {
  const toUs = Date.now() * 1000
  const fromUs = toUs - days * 24 * 60 * 60 * 1_000_000
  return { fromUs, toUs }
}
