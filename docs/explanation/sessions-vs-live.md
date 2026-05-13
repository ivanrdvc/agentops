# Sessions vs Live

Two top-level entries in the UI, two different jobs.

## The split

**Sessions — pure observability.**
The conversation history of an agent. Always read-only. Today it's reconstructed from telemetry; later it may come from a DB mirror, an external API, or a paste-in. The page doesn't care where spans come from, only that it gets them.

**Live — the active / current surface.**
One execution at a time. The page is the home for everything in this family: live-tailing a run as spans flush in from the exporter, hooking up to a running app and streaming its events, or actually initiating a run against an external agent. Today, with none of that wired up yet, `/live` is an empty-state landing page; `/live/$runId` renders any single trace you navigate to.

The internal unit is called a `run`. The page is called Live because that's what makes it different from Sessions — it's where things in motion go. Finished runs surface under Sessions (joined by session id, with an agent-instance-hex fallback), not as a separate "all runs" list.

| | Sessions | Live |
|---|---|---|
| Job | Read what happened | Watch / drive what's happening |
| Unit | A conversation (many runs) | One run |
| Read-only? | Always | Currently — not by design |
| Data origin (today) | Telemetry, joined by `session.id` / `gen_ai.conversation.id` / `ag_ui_thread_id` / agent-instance-hex fallback | Telemetry, one `trace_id` per page |
| Data origin (future) | + DB, external feeds | + live exporter stream, + direct invocation of an external agent |

A run that doesn't resolve to a session id (no attribute, no `invoke_agent` hex to fall back on) currently has no listing surface. It's still reachable by direct `/live/$runId` URL — but it won't appear anywhere until live-tail or initiate-a-run ships.

## Session detail (`/sessions/$sessionId`)

Toggle `[Conversation | Spans]`.

**Conversation tab (default).** Two-column.
- **Left** — `TurnsView` (`src/components/turns-view.tsx`): token-usage table (`# · Time · In · Out · Errs · Turn · Σ · Dur` + Total), the breakdown panel below (`System prompts · Tool definitions · Messages · Prompt cache · Total`) computed by `useBreakdowns` (`src/lib/use-breakdowns.ts`) on top of `breakdownChat` in `src/lib/tokens.ts`, then one card per turn with status / cost / duration.
- **Right** — `ConversationView` (`src/components/conversation-view.tsx`): chat bubbles, paired tool cards, agent cards. Renders `ConversationEvent[]` from `src/lib/conversation.ts`.

**Spans tab.** `TreeView` (waterfall) + "Select a span" detail panel. The debug-primitive shape for when the conversation isn't enough.

## Live detail (`/live/$runId`)

Just the conversation, full width — `ConversationView` and nothing else. One run is one assistant turn; the aggregate-per-turn panel has nothing to chew on at this scale.

What's coming next here:
- **Live tail.** Spans appear in the conversation as they flush from the exporter — granularity is one span, not tokens.
- **Direct ingest.** An app POSTs events to us instead of going through OTel. Same render.
- **Initiate a run.** Send a prompt from the UI to a configured agent endpoint; the conversation that comes back is just another run.

The Spans/waterfall view can come back behind an opt-in if needed — not the default.

## List pages

Only `/sessions` is a list. Its toolbar pieces (`SearchInput`, `StatusPills`) plus `formatAgo` / `formatCost` / `truncateId` in `src/lib/format.ts` are the shared primitives any future Live list (active runs, queued runs) should reuse.

## Data fetching

Route loaders call `context.queryClient.ensureQueryData(...)` and components read via `useQuery(...)` — keys + `queryOptions` live in `src/lib/queries.ts`. SSR hydration is wired through `@tanstack/react-router-ssr-query` in `src/router.tsx`. Default `QueryClient` settings (no custom `staleTime` / `gcTime` / `retry`).

## Where to extend

| You want to… | Edit |
|---|---|
| Show a new per-span field | `Span` in `src/lib/spans.ts`, then lift in `src/lib/classify-span.ts` (both dotted and underscore-flattened forms) |
| Add a new event kind in the chat (eval result, feedback, etc.) | New arm on `ConversationEvent` in `src/lib/conversation.ts`, render in `ConversationView` |
| Add a format helper | `src/lib/format.ts` — don't reinvent |
| Support a new tokenizer family | Extend `resolveFamily` in `src/lib/tokens.ts`. Lazy-load the encoder data |
| Add a new data source for Sessions (DB, external) | The session detail loader in `src/routes/sessions/$sessionId.tsx`. Page only consumes `Span[]`, so anything that yields spans works |
| Add live tail / direct ingest | `src/routes/live/$runId.tsx`: replace the one-shot fetch with a subscription that pushes new spans into the same `ConversationView`. For an active-runs list, build a new view on top of `tracesQuery` / `listRecentTraces` |
