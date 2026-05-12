import type { Span } from '#/lib/spans'
import { createOpenObserveProvider } from './openobserve'
import type {
  ListSessionsOpts,
  ListTracesOpts,
  SessionSummary,
  TelemetryProvider,
  TraceSummary,
} from './types'

export type {
  TelemetryProvider,
  TraceFetch,
  GetTraceOpts,
  TraceSummary,
  ListTracesOpts,
  SessionSummary,
  ListSessionsOpts,
  SessionFetch,
} from './types'

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

export async function listRecentSessions(opts?: ListSessionsOpts): Promise<{
  sessions: SessionSummary[]
  truncated: boolean
  provider: string
  fingerprint: string
} | null> {
  const p = getActiveProvider()
  if (!p.listSessions) return null
  const r = await p.listSessions(opts)
  return { sessions: r.sessions, truncated: r.truncated, provider: p.name, fingerprint: p.fingerprint }
}

export async function getSession(sessionId: string): Promise<{
  sessionId: string
  source: 'attribute' | 'agent-instance'
  spans: Span[]
  traceIds: string[]
  provider: string
  fingerprint: string
} | null> {
  const p = getActiveProvider()
  if (!p.getSession) return null
  const r = await p.getSession(sessionId)
  if (r.kind !== 'found') return null
  return {
    sessionId: r.sessionId,
    source: r.source,
    spans: r.spans,
    traceIds: r.traceIds,
    provider: p.name,
    fingerprint: p.fingerprint,
  }
}

