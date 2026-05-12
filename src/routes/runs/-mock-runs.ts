// Mock until ingest + loader land. `now` is captured at module load so the
// "Xm ago" labels stay coherent within a session.
export type RunStatus = 'ok' | 'error'

export interface RunSummary {
  id: string
  agent: string
  status: RunStatus
  startedAt: number
  costUsd: number
}

const now = Date.now()
const min = 60_000
const hr = 60 * min

export const MOCK_RUNS: RunSummary[] = [
  { id: '4821', agent: 'proverbs-agent', status: 'ok', startedAt: now - 2 * min, costUsd: 0.0009 },
  { id: '182', agent: 'lead-qualifier', status: 'ok', startedAt: now - 12 * min, costUsd: 0.0002 },
  { id: '4820', agent: 'code-review', status: 'error', startedAt: now - 38 * min, costUsd: 0.0023 },
  { id: '4819', agent: 'proverbs-agent', status: 'ok', startedAt: now - 1 * hr, costUsd: 0.0008 },
  { id: '181', agent: 'lead-qualifier', status: 'ok', startedAt: now - 2 * hr, costUsd: 0.0001 },
  { id: '4818', agent: 'code-review', status: 'ok', startedAt: now - 3 * hr, costUsd: 0.0041 },
  { id: '4817', agent: 'proverbs-agent', status: 'ok', startedAt: now - 5 * hr, costUsd: 0.001 },
  { id: '180', agent: 'lead-qualifier', status: 'error', startedAt: now - 7 * hr, costUsd: 0.0003 },
  { id: '4816', agent: 'code-review', status: 'ok', startedAt: now - 11 * hr, costUsd: 0.0038 },
  { id: '4815', agent: 'proverbs-agent', status: 'ok', startedAt: now - 26 * hr, costUsd: 0.0007 },
  { id: '179', agent: 'lead-qualifier', status: 'ok', startedAt: now - 30 * hr, costUsd: 0.0002 },
  { id: '4814', agent: 'code-review', status: 'ok', startedAt: now - 52 * hr, costUsd: 0.0044 },
]
