import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/palette')({
  component: PalettePreview,
})

const ROLES = [
  {
    name: 'lavender',
    hex: '#d898d8',
    role: 'Brand',
    note: 'Primary accent from the command text.',
  },
  { name: 'zinc', hex: '#71717a', role: 'Surface', note: 'Text, borders, backgrounds — 90%+ of pixels.' },
  { name: 'emerald', hex: '#10b981', role: 'Success', note: 'ok dot, healthy pill.' },
  { name: 'rose', hex: '#f43f5e', role: 'Error', note: 'error dot/pill/border.' },
  { name: 'warm amber', hex: '#f0c870', role: 'Warning', note: 'Attention dot from the sidebar.' },
  { name: 'sky', hex: '#0ea5e9', role: 'Info / live', note: 'in-progress, streaming.' },
] as const

function PalettePreview() {
  return (
    <div className="flex flex-col gap-10">
      <header className="space-y-1">
        <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">Palette</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Screenshot-derived accents: lavender <span className="font-mono">#d898d8</span> and warm amber{' '}
          <span className="font-mono">#f0c870</span>. Categorical things (session id, service) go neutral. Token arrows
          are neutral too — arrows carry direction.
        </p>
      </header>

      <Block title="Hue family">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          The lavender is the structural accent: agent names, focus rings, selected states, and sub-agent boundaries.
          The amber is deliberately warmer, so it stays reserved for attention and warning moments.
        </p>

        <Example label="Brand family — soft lavender">
          <div className="flex flex-wrap items-center gap-2">
            <Swatch hex="#974797" name="accent-700" hue={300} delta="deep" tag="in" />
            <Swatch hex="#71717a" name="zinc" hue={285} delta="surface" tag="surface" />
            <Swatch hex="#d898d8" name="accent-400" hue={300} delta="source" tag="in" />
          </div>
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            zinc surfaces + lavender identity = one quiet command-line inspired system.
          </p>
        </Example>

        <Example label="Outside — status and attention">
          <div className="flex flex-wrap items-center gap-2">
            <Swatch hex="#10b981" name="emerald" hue={162} delta="far" tag="status" />
            <Swatch hex="#f0c870" name="warm amber" hue={43} delta="source" tag="status" />
            <Swatch hex="#f43f5e" name="rose" hue={13} delta="far" tag="status" />
            <Swatch hex="#0ea5e9" name="sky" hue={237} delta="far" tag="status" />
          </div>
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            Distance from the lavender family is why these pop — status colors should be visually unrelated to the
            surface.
          </p>
        </Example>

        <Example label="Available — nearby but unused (optional brand extensions)">
          <div className="flex flex-wrap items-center gap-2">
            <Swatch hex="#a855f7" name="purple" hue={303} delta="+18°" tag="avail" />
            <Swatch hex="#c026d3" name="fuchsia" hue={322} delta="+37°" tag="drift" />
            <Swatch hex="#64748b" name="slate" hue={240} delta="−45°" tag="drift" />
          </div>
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            Reach for these only if lavender is not enough. Too much saturated purple starts to feel like a different
            product.
          </p>
        </Example>
      </Block>

      <Block title="Roles">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ROLES.map((c) => (
            <div key={c.name}>
              <div
                className="h-14 w-full rounded-md ring-1 ring-zinc-950/5 dark:ring-white/10"
                style={{ backgroundColor: c.hex }}
              />
              <div className="mt-1.5 text-[11px] font-medium text-zinc-950 dark:text-white">{c.role}</div>
              <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                {c.name}-500 · {c.hex}
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">{c.note}</div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Status">
        <Example label="Pills">
          <div className="flex flex-wrap items-center gap-2">
            <Pill color="emerald">success</Pill>
            <Pill color="rose">error</Pill>
            <Pill color="warm">warning</Pill>
            <Pill color="sky">in-progress</Pill>
          </div>
        </Example>

        <Example label="Dots">
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-2">
              <Dot color="emerald" /> ok
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot color="rose" /> error
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot color="warm" /> warning
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot color="sky" /> live
            </span>
          </div>
        </Example>
      </Block>

      <Block title="Brand — lavender (agent identity)">
        <Example label="Agent name (bare text)">
          <span className="font-medium text-accent-600 dark:text-accent-400">proverbs-agent</span>
        </Example>

        <Example label="Sub-agent boundary">
          <div className="rounded-md border border-accent-500/30 p-3 dark:border-accent-400/30">
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="rounded bg-accent-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-accent-700 uppercase dark:text-accent-300">
                sub-agent
              </span>
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">Explorer</span>
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Nested content. Violet boundary is the only thing signaling scope shift.
            </div>
          </div>
        </Example>
      </Block>

      <Block title="Categorical — neutral chips">
        <Example label="Session id, service, span kind — never accent">
          <div className="flex flex-wrap items-center gap-2">
            <NeutralChip>otel-collector</NeutralChip>
            <NeutralChip mono>🧵 a7f2…3c91</NeutralChip>
            <NeutralChip mono>chat</NeutralChip>
            <NeutralChip mono>span_id</NeutralChip>
          </div>
        </Example>
      </Block>

      <Block title="Tokens — neutral, arrows carry direction">
        <Example label="No color tinting on numbers">
          <span className="inline-flex items-center gap-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            <span>↑1,240</span>
            <span>↓312</span>
          </span>
        </Example>
      </Block>

      <Block title="In context — one trace row">
        <div className="rounded-md border border-zinc-950/10 dark:border-white/10">
          <Row
            status="ok"
            time="2m ago"
            agent="proverbs-agent"
            service="otel-collector"
            session="a7f2…3c91"
            cost="$0.0421"
            tokensIn={1240}
            tokensOut={312}
          />
          <Row
            status="ok"
            time="14m ago"
            agent="lead-qualifier"
            service="mastra-devui"
            session="b91d…2e44"
            cost="$0.0093"
            tokensIn={420}
            tokensOut={88}
          />
          <Row
            status="error"
            time="1h ago"
            agent="code-review"
            service="otel-collector"
            session="c402…8f1a"
            cost="$0.0317"
            tokensIn={2103}
            tokensOut={91}
          />
        </div>
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          One row uses 4 of the 6 roles: zinc (numbers, service chip), lavender (agent name), emerald/rose (status dot),
          and neutral chip (session). No color spam.
        </p>
      </Block>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold tracking-wider text-zinc-950 uppercase dark:text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Example({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div>{children}</div>
    </div>
  )
}

type StatusColor = 'emerald' | 'rose' | 'warm' | 'sky'

function Pill({ color, children }: { color: StatusColor; children: React.ReactNode }) {
  const map: Record<StatusColor, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    warm: 'bg-accent-warm-500/10 text-accent-warm-800 dark:text-accent-warm-300',
    sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  }
  return <span className={`rounded ${map[color]} px-1.5 py-0.5 text-[10px] font-medium`}>{children}</span>
}

function Dot({ color }: { color: StatusColor }) {
  const map: Record<StatusColor, string> = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    warm: 'bg-accent-warm-400',
    sky: 'bg-sky-500',
  }
  return <span className={`inline-block size-1.5 rounded-full ${map[color]}`} />
}

function Swatch({
  hex,
  name,
  hue,
  delta,
  tag,
}: {
  hex: string
  name: string
  hue: number
  delta: string
  tag: 'in' | 'surface' | 'status' | 'avail' | 'drift'
}) {
  const ringMap = {
    in: 'ring-accent-500/40 dark:ring-accent-400/40',
    surface: 'ring-zinc-950/20 dark:ring-white/20',
    status: 'ring-zinc-950/5 dark:ring-white/10',
    avail: 'ring-zinc-950/5 dark:ring-white/10',
    drift: 'ring-zinc-950/5 dark:ring-white/10',
  } as const
  return (
    <div className="flex flex-col items-start gap-1">
      <div className={`h-10 w-16 rounded-md ring-1 ${ringMap[tag]}`} style={{ backgroundColor: hex }} />
      <div className="text-[11px] font-medium text-zinc-950 dark:text-white">{name}</div>
      <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
        {hue}° · {delta}
      </div>
    </div>
  )
}

function NeutralChip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={`rounded bg-zinc-950/5 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-white/5 dark:text-zinc-400 ${
        mono ? 'font-mono text-[10px]' : ''
      }`}
    >
      {children}
    </span>
  )
}

function Row({
  status,
  time,
  agent,
  service,
  session,
  cost,
  tokensIn,
  tokensOut,
}: {
  status: 'ok' | 'error'
  time: string
  agent: string
  service: string
  session: string
  cost: string
  tokensIn: number
  tokensOut: number
}) {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-950/5 px-3 py-1.5 text-xs last:border-b-0 dark:border-white/5">
      <span className="inline-flex items-center gap-2 tabular-nums text-zinc-500 dark:text-zinc-400">
        <Dot color={status === 'ok' ? 'emerald' : 'rose'} />
        {time}
      </span>
      <span className="font-medium text-accent-600 dark:text-accent-400">{agent}</span>
      <NeutralChip>{service}</NeutralChip>
      <NeutralChip mono>🧵 {session}</NeutralChip>
      <span className="ml-auto inline-flex items-center gap-2 font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
        <span>↑{tokensIn}</span>
        <span>↓{tokensOut}</span>
      </span>
      <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{cost}</span>
    </div>
  )
}
