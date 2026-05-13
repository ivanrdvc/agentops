import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { useMemo } from 'react'
import { useBreakdowns } from '#/hooks/use-breakdowns'
import type { Span } from '#/lib/spans'
import { formatCost } from '#/lib/spans'

interface ContextWindowProps {
  spans: Span[]
}

// Conservative context-window lookup. Wrong values are worse than missing — we
// fall back to a "—" label rather than guessing when the model string doesn't
// match anything known.
function contextWindowFor(model: string | undefined): number | null {
  const m = (model ?? '').toLowerCase()
  if (!m) return null
  if (m.startsWith('claude')) return 200_000
  if (m.startsWith('gpt-4.1')) return 1_000_000
  if (m.startsWith('gpt-5')) return 400_000
  if (m.startsWith('gpt-4o') || m.startsWith('chatgpt-4o')) return 128_000
  if (m.startsWith('gpt-4-turbo') || m.startsWith('gpt-4-1106') || m.startsWith('gpt-4-0125')) return 128_000
  if (m.startsWith('gpt-4')) return 8_192
  if (m.startsWith('gpt-3.5')) return 16_385
  if (m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 200_000
  if (m.startsWith('gemini-2') || m.startsWith('gemini-1.5')) return 1_000_000
  return null
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}K`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

export function ContextWindow({ spans }: ContextWindowProps) {
  const chatSpans = useMemo(() => spans.filter((s) => s.operation === 'chat'), [spans])
  const { ready, total } = useBreakdowns(chatSpans)

  // Peak input across turns — the most the model had to hold at once.
  const peakSpan = useMemo(() => {
    let max: Span | null = null
    for (const s of chatSpans) {
      if ((s.inputTokens ?? 0) > (max?.inputTokens ?? 0)) max = s
    }
    return max
  }, [chatSpans])

  const model = peakSpan?.model
  const limit = contextWindowFor(model)
  const peakInput = peakSpan?.inputTokens ?? 0
  const pct = limit ? Math.min(1, peakInput / limit) : 0

  const totalInput = useMemo(() => chatSpans.reduce((s, c) => s + (c.inputTokens ?? 0), 0), [chatSpans])
  const totalOutput = total.outputTokens || chatSpans.reduce((s, c) => s + (c.outputTokens ?? 0), 0)
  const totalCost = useMemo(() => chatSpans.reduce((s, c) => s + (c.costUsd ?? 0), 0), [chatSpans])

  if (chatSpans.length === 0) return null

  return (
    <Popover className="relative">
      <PopoverButton
        className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-950/20 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white dark:focus-visible:ring-white/20"
        aria-label="Model context usage"
      >
        <span className="tabular-nums">{limit ? `${(pct * 100).toFixed(1)}%` : formatTokens(peakInput)}</span>
        <Ring pct={pct} />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom end', gap: 6 }}
        transition
        className="z-20 w-64 rounded-lg border border-zinc-950/10 bg-white text-xs shadow-lg ring-1 ring-black/5 outline-hidden transition data-closed:opacity-0 dark:border-white/10 dark:bg-zinc-900 dark:ring-white/10"
      >
        <div className="border-b border-zinc-950/5 px-3 py-2 dark:border-white/10">
          <div className="flex items-baseline justify-between">
            <div className="font-medium tabular-nums text-zinc-950 dark:text-white">
              {limit ? `${(pct * 100).toFixed(1)}%` : formatTokens(peakInput)}
            </div>
            <div className="tabular-nums text-zinc-500 dark:text-zinc-400">
              {limit ? `${formatTokens(peakInput)} / ${formatTokens(limit)}` : `${formatTokens(peakInput)} peak`}
            </div>
          </div>
          {limit && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-950/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-zinc-950 dark:bg-white" style={{ width: `${pct * 100}%` }} />
            </div>
          )}
          {model && <div className="mt-1.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{model}</div>}
        </div>

        <dl className="space-y-1.5 px-3 py-2.5">
          <Row label="Input" value={formatTokens(totalInput)} dim={!ready} />
          <Row label="Output" value={formatTokens(totalOutput)} dim={!ready} />
          {total.cachedTokens > 0 && <Row label="Cached" value={formatTokens(total.cachedTokens)} dim={!ready} />}
        </dl>

        {totalCost > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-950/5 px-3 py-2 dark:border-white/10">
            <span className="text-zinc-500 dark:text-zinc-400">Total cost</span>
            <span className="font-medium tabular-nums text-zinc-950 dark:text-white">
              ${formatCost(totalCost) ?? totalCost.toFixed(4)}
            </span>
          </div>
        )}
      </PopoverPanel>
    </Popover>
  )
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={[
          'tabular-nums transition-opacity',
          dim ? 'opacity-40' : 'opacity-100',
          'text-zinc-950 dark:text-white',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}

// Matches the AI Elements ring exactly — two concentric circles, the second
// stroked with a dasharray sized so dashoffset linearly maps usage to fill.
function Ring({ pct }: { pct: number }) {
  const r = 10
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)
  return (
    <svg
      aria-label="Model context usage"
      role="img"
      viewBox="0 0 24 24"
      width={20}
      height={20}
      style={{ color: 'currentcolor' }}
    >
      <title>{`${(pct * 100).toFixed(1)}% of context used`}</title>
      <circle cx={12} cy={12} r={r} fill="none" opacity={0.25} stroke="currentColor" strokeWidth={2} />
      <circle
        cx={12}
        cy={12}
        r={r}
        fill="none"
        opacity={0.7}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center center' }}
      />
    </svg>
  )
}
