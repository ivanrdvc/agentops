import type { Span } from '#/lib/spans'

export type TraceFetch =
  | { kind: 'found'; spans: Span[]; truncated?: boolean }
  | { kind: 'not_found' }

export interface GetTraceOpts {
  fromUs?: number
  toUs?: number
}

export interface ListTracesOpts {
  fromUs?: number
  toUs?: number
  limit?: number
}

export interface TraceSummary {
  id: string
  startedAtMs: number
  durationMs: number
  spanCount: number
  agent?: string
  totalTokens?: number
  totalCostUsd?: number
  hasError?: boolean
}

export interface TelemetryProvider {
  name: string
  fingerprint: string

  // 'found'     -> chain stops, spans returned
  // 'not_found' -> definitively no trace by this id; chain tries next provider
  // throws      -> real error (auth/network); chain logs and continues
  getTrace(traceId: string, opts?: GetTraceOpts): Promise<TraceFetch>

  // Aggregated summary of recent traces. Optional: a provider that only
  // supports point-lookups returns undefined here and the index page skips it.
  listTraces?(opts?: ListTracesOpts): Promise<TraceSummary[]>

  // getLogs?(filter, opts?): Promise<LogEntry[]>
  // getMetric?(name, range): Promise<MetricSeries>
}
