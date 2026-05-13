# Palette

6 roles, one job each. Built on stock Tailwind v4 (OKLCH; no `tailwind.config.*`, only `--font-sans` is set in `@theme`). Catalyst owns its component-internal tokens — the palette governs the app surface, not Catalyst internals.

A live reference lives at `/palette` (`src/routes/palette.tsx`).

## Hue family

Tailwind v4 `zinc` sits at hue **285°** in OKLCH (purple-magenta direction, very low chroma). That's not a bug — it's the stock palette. We lean into it:

- **Within ±10° of 285° → brand and structure.** Harmonize with the surface.
- **Outside → status.** Pops because it's visually unrelated to the surface.

In family:

- `indigo` (277°) — selection / focus state
- `zinc` (285°) — surface
- `violet` (293°) — brand: agent identity, sub-agent boundary

Outside:

- `emerald` (162°) — success
- `amber` (70°) — warning
- `rose` (13°) — error
- `sky` (237°) — info / live / in-progress

## Roles

| Role | Color | Where it shows up |
|---|---|---|
| Surface | `zinc` | Text, borders, backgrounds — 90%+ of pixels. |
| Brand · agent identity | `violet` | Agent names (bare text). Sub-agent boundary (border + tag pill). |
| Selected | `indigo` | Row selection / focused item. |
| Success | `emerald` | Status only — ok dot, healthy pill, completed step. |
| Error | `rose` | Status only — error dot/pill/border. |
| Warning | `amber` | Status only — degraded, truncated, heuristic. |
| Info / live | `sky` | Streaming spans, in-progress turns. |
| Categorical | — | Session id, service name, span kind → neutral chip. |
| Directional (token in/out) | — | Arrows ↑↓ carry direction; text stays zinc. |

## Tokens

Status pill (replace `{c}` with `emerald` | `rose` | `amber` | `sky`):

```
rounded bg-{c}-500/10 px-1.5 py-0.5 text-[10px] font-medium text-{c}-700 dark:text-{c}-300
```

Status dot:

```
inline-block size-1.5 rounded-full bg-{c}-500
```

Agent name (bare text):

```
font-medium text-violet-600 dark:text-violet-400
```

Sub-agent boundary / label:

```
border-violet-500/30 dark:border-violet-400/30
bg-violet-500/15 text-violet-700 dark:text-violet-300
```

Selected row:

```
bg-indigo-500/15 dark:bg-indigo-400/15
```

Neutral chip (categorical IDs, service names, code-like inline text):

```
rounded bg-zinc-950/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-white/5 dark:text-zinc-400
```

Card surface (Catalyst default for panels):

```
lg:rounded-lg lg:bg-white lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5
dark:lg:bg-zinc-900 dark:lg:ring-white/10
```

Fine-line border:

```
border-zinc-950/10 dark:border-white/10
```

Text scale:

- Page heading: `text-sm font-semibold text-zinc-950 dark:text-white`
- Body: `text-xs text-zinc-500 dark:text-zinc-400`
- Tabular nums: `tabular-nums text-zinc-500 dark:text-zinc-400`
- Mono small: `font-mono text-[11px]`
- Eyebrow: `text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400`

## Sweep (not yet applied)

1. `components/tree-view.tsx:143` — service name rose → violet.
2. `routes/runs/index.tsx:190` — agent name → violet.
3. `routes/runs/index.tsx:199` — session pill indigo → neutral chip.
4. `routes/sessions/index.tsx:123` — agent name → violet.
5. `components/conversation-view.tsx:157-158` — token arrows indigo/emerald → neutral zinc.
6. `components/conversation-view.tsx:283` — pending pill amber → sky.
7. `components/turns-view.tsx:134` — tool pill amber → neutral chip.

## Not doing

- Replacing zinc. The purple-magenta lean (285°) is stock Tailwind v4, by design.
- Custom Tailwind theme color tokens. Roles map to existing palette names.
- Repainting Catalyst internals (Button, Sidebar, etc).
