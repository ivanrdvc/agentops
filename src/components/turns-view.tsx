import { useMemo } from 'react'
import { useBreakdowns } from '#/hooks/use-breakdowns'
import { formatDuration, formatPercent, formatTime } from '#/lib/format'
import { findOrchestratorId, formatCost, type Span, spanHasError } from '#/lib/spans'
import type { ChatBreakdown } from '#/lib/tokens'

interface Turn {
  llm: Span
  actions: Span[]
}

function extractTurns(spans: Span[], orchestratorId: string): Turn[] {
  const children = spans.filter((s) => s.parentId === orchestratorId).sort((a, b) => a.startMs - b.startMs)
  const turns: Turn[] = []
  let current: Turn | null = null
  for (const c of children) {
    if (c.operation === 'chat') {
      if (current) turns.push(current)
      current = { llm: c, actions: [] }
    } else if (current && (c.operation === 'tool' || c.operation === 'invoke_agent')) {
      current.actions.push(c)
    }
  }
  if (current) turns.push(current)
  return turns
}

interface TurnsViewProps {
  spans: Span[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function TurnsView({ spans, selectedId, onSelect }: TurnsViewProps) {
  const orchestratorId = findOrchestratorId(spans)
  const turns = useMemo(() => (orchestratorId ? extractTurns(spans, orchestratorId) : []), [spans, orchestratorId])
  if (!orchestratorId) {
    return (
      <div className="px-3 py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        No agent invocation found in this run.
      </div>
    )
  }
  const orchestrator = spans.find((s) => s.id === orchestratorId)
  const agent = orchestrator?.agentName ?? orchestrator?.name ?? '—'

  return (
    <div className="flex flex-col gap-3 p-3">
      <TurnsSummary turns={turns} agent={agent} />
      <ol className="flex flex-col gap-2">
        {turns.map((turn, i) => (
          <TurnCard
            key={turn.llm.id}
            index={i + 1}
            turn={turn}
            selected={turn.llm.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </div>
  )
}

function TurnsSummary({ turns, agent }: { turns: Turn[]; agent: string }) {
  let runningTokens = 0
  let totalIn = 0
  let totalOut = 0
  let totalErrs = 0
  let totalDurationMs = 0
  const chatSpans = useMemo(() => turns.map((t) => t.llm), [turns])
  const { ready, total } = useBreakdowns(chatSpans)

  const rows = turns.map((t, i) => {
    const input = t.llm.inputTokens ?? 0
    const output = t.llm.outputTokens ?? 0
    const errs = t.actions.filter(spanHasError).length
    const turnTotal = input + output
    runningTokens += turnTotal
    totalIn += input
    totalOut += output
    totalErrs += errs
    const durationMs = t.llm.endMs - t.llm.startMs
    totalDurationMs += durationMs
    return {
      index: i + 1,
      startMs: t.llm.startMs,
      input,
      output,
      errs,
      turnTotal,
      running: runningTokens,
      durationMs,
    }
  })

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-950/5 bg-white dark:border-white/8 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-950/5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 dark:border-white/5 dark:text-zinc-400">
        <span>
          Token usage <span className="text-zinc-400 dark:text-zinc-500">· {agent}</span>
        </span>
        <span className="tabular-nums">
          {turns.length} turn{turns.length === 1 ? '' : 's'}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] tabular-nums">
          <thead className="text-zinc-500 dark:text-zinc-400">
            <tr className="text-right">
              <th className="px-2 py-1 text-left font-medium">#</th>
              <th className="px-2 py-1 text-left font-medium">Time</th>
              <th className="px-2 py-1 font-medium">In</th>
              <th className="px-2 py-1 font-medium">Out</th>
              <th className="px-2 py-1 font-medium">Errs</th>
              <th className="px-2 py-1 font-medium">Turn</th>
              <th className="px-2 py-1 font-medium">Σ</th>
              <th className="px-2 py-1 font-medium">Dur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.index}
                className="border-t border-zinc-950/5 text-right text-zinc-700 dark:border-white/5 dark:text-zinc-300"
              >
                <td className="px-2 py-1 text-left text-zinc-500 dark:text-zinc-400">{r.index}</td>
                <td className="px-2 py-1 text-left text-zinc-500 dark:text-zinc-400">{formatTime(r.startMs)}</td>
                <td className="px-2 py-1">{r.input ? r.input.toLocaleString() : '—'}</td>
                <td className="px-2 py-1">{r.output ? r.output.toLocaleString() : '—'}</td>
                <td className={`px-2 py-1 ${r.errs ? 'text-rose-600 dark:text-rose-400' : ''}`}>{r.errs || '—'}</td>
                <td className="px-2 py-1">{r.turnTotal ? r.turnTotal.toLocaleString() : '—'}</td>
                <td className="px-2 py-1 text-zinc-500 dark:text-zinc-400">{r.running.toLocaleString()}</td>
                <td className="px-2 py-1">{formatDuration(r.durationMs)}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-950/10 text-right font-medium text-zinc-950 dark:border-white/10 dark:text-white">
              <td className="px-2 py-1 text-left" colSpan={2}>
                Total
              </td>
              <td className="px-2 py-1">{totalIn.toLocaleString()}</td>
              <td className="px-2 py-1">{totalOut.toLocaleString()}</td>
              <td className={`px-2 py-1 ${totalErrs ? 'text-rose-600 dark:text-rose-400' : ''}`}>{totalErrs || '—'}</td>
              <td className="px-2 py-1">{(totalIn + totalOut).toLocaleString()}</td>
              <td className="px-2 py-1">—</td>
              <td className="px-2 py-1">{formatDuration(totalDurationMs)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <BreakdownPanel ready={ready} total={total} providerIn={totalIn} providerOut={totalOut} />
    </section>
  )
}

function BreakdownPanel({
  ready,
  total,
  providerIn,
  providerOut,
}: {
  ready: boolean
  total: ChatBreakdown
  providerIn: number
  providerOut: number
}) {
  const inputTokens = total.inputTokens || providerIn
  const outputTokens = total.outputTokens || providerOut
  const grandTotal = inputTokens + outputTokens
  return (
    <div className="border-t border-zinc-950/10 px-3 py-2 dark:border-white/10">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        <span>Input breakdown</span>
        <span
          aria-hidden={ready}
          className={['text-zinc-400 transition-opacity dark:text-zinc-500', ready ? 'opacity-0' : 'opacity-100'].join(
            ' ',
          )}
        >
          counting…
        </span>
      </div>
      <div className="grid grid-cols-5 gap-x-3 text-[11px] tabular-nums">
        <BreakdownCell label="System prompts" tokens={total.systemTokens} denom={inputTokens} />
        <BreakdownCell
          label={`Tool definitions (${total.toolDefsCount})`}
          tokens={total.toolDefsTokens}
          denom={inputTokens}
        />
        <BreakdownCell label="Messages" tokens={total.messagesTokens} denom={inputTokens} />
        <div>
          <div className="text-zinc-500 dark:text-zinc-400">Prompt cache</div>
          <div className="text-zinc-950 dark:text-white">{total.cachedTokens.toLocaleString()}</div>
          <div className="text-zinc-400 dark:text-zinc-500">
            {total.cachedTokens ? `${formatPercent(total.cachedTokens, inputTokens)} of input` : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-zinc-500 dark:text-zinc-400">Total</div>
          <div className="font-medium text-zinc-950 dark:text-white">{grandTotal.toLocaleString()}</div>
          <div className="text-zinc-400 dark:text-zinc-500">
            ({inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out)
          </div>
        </div>
      </div>
    </div>
  )
}

function BreakdownCell({ label, tokens, denom }: { label: string; tokens: number; denom: number }) {
  return (
    <div>
      <div className="text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-zinc-950 dark:text-white">{tokens ? tokens.toLocaleString() : '—'}</div>
      <div className="min-h-[1em] text-zinc-400 dark:text-zinc-500">{tokens ? formatPercent(tokens, denom) : null}</div>
    </div>
  )
}

interface TurnCardProps {
  index: number
  turn: Turn
  selected: boolean
  onSelect: (id: string) => void
}

function TurnCard({ index, turn, selected, onSelect }: TurnCardProps) {
  const { llm, actions } = turn
  const hasError = actions.some(spanHasError)
  const cost = formatCost(llm.costUsd ?? 0)

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(llm.id)}
        className={[
          'flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-xs',
          selected
            ? 'border-zinc-950/30 bg-zinc-100 dark:border-white/30 dark:bg-white/10'
            : hasError
              ? 'border-rose-500/30 hover:bg-rose-500/5 dark:border-rose-400/30 dark:hover:bg-rose-400/5'
              : 'border-zinc-950/10 hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-white/5',
        ].join(' ')}
      >
        <span className="font-semibold text-zinc-950 dark:text-white">Turn {index}</span>
        <StatusBadge hasError={hasError} />
        <span className="ml-auto flex items-center gap-3 tabular-nums text-zinc-500 dark:text-zinc-400">
          {llm.tokens != null && <span>{llm.tokens} tok</span>}
          {cost && <span>${cost}</span>}
          <span>{formatDuration(llm.endMs - llm.startMs)}</span>
        </span>
      </button>
    </li>
  )
}

function StatusBadge({ hasError }: { hasError: boolean }) {
  if (hasError) {
    return (
      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
        ✗ Err
      </span>
    )
  }
  return (
    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
      ✓ OK
    </span>
  )
}
