export const queryKeys = {
  sessions: {
    all: () => ['sessions'] as const,
    detail: (id: string) => ['sessions', id] as const,
  },
  traces: {
    all: () => ['traces'] as const,
    detail: (id: string) => ['traces', id] as const,
  },
  inbox: {
    all: () => ['inbox'] as const,
    unreadCount: () => ['inbox', 'unread-count'] as const,
  },
  home: {
    all: () => ['home'] as const,
  },
  mcp: {
    all: () => ['mcp'] as const,
  },
  providers: {
    all: () => ['providers'] as const,
  },
}

export const STALE_LIVE_MS = 15_000
export const STALE_TELEMETRY_MS = 60_000
