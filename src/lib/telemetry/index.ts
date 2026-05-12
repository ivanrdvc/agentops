import type { Span } from '#/lib/spans'
import { createOpenObserveProvider } from './openobserve'
import type { ListTracesOpts, TelemetryProvider, TraceSummary } from './types'

export type { TelemetryProvider, TraceFetch, GetTraceOpts, TraceSummary, ListTracesOpts } from './types'

// One active provider at a time. Defaults to local OpenObserve with the
// docker image's admin creds so a fresh setup works zero-config. Override
// any of OO_BASE_URL / OO_USER / OO_PASS, or flip the provider entirely
// with TELEMETRY_PROVIDER=app-insights.
let cached: TelemetryProvider | null = null

export function getActiveProvider(): TelemetryProvider {
  if (cached) return cached

  const choice = process.env.TELEMETRY_PROVIDER ?? 'openobserve'

  if (choice === 'app-insights') {
    throw new Error('app-insights provider is not implemented yet')
  }

  if (choice !== 'openobserve') {
    throw new Error(`unknown TELEMETRY_PROVIDER: ${choice}`)
  }

  cached = createOpenObserveProvider({
    baseUrl: process.env.OO_BASE_URL ?? 'http://localhost:5080',
    org: process.env.OO_ORG ?? 'default',
    stream: process.env.OO_STREAM ?? 'default',
    user: process.env.OO_USER ?? 'root@example.com',
    password: process.env.OO_PASS ?? 'Complexpass#123',
  })
  return cached
}

export async function getTrace(traceId: string): Promise<{
  spans: Span[]
  truncated: boolean
  provider: string
  fingerprint: string
} | null> {
  const p = getActiveProvider()
  const r = await p.getTrace(traceId)
  if (r.kind !== 'found') return null
  return { spans: r.spans, truncated: !!r.truncated, provider: p.name, fingerprint: p.fingerprint }
}

export async function listRecentTraces(opts?: ListTracesOpts): Promise<{
  traces: TraceSummary[]
  provider: string
  fingerprint: string
} | null> {
  const p = getActiveProvider()
  if (!p.listTraces) return null
  return { traces: await p.listTraces(opts), provider: p.name, fingerprint: p.fingerprint }
}

