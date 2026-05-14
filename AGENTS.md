# agentops

"TODO" means the root `TODO.md` — read it, append entries there when relevant.

For docs structure and where to put new ones, see `docs/README.md`.

## Layout

- `src/routes/` — file-based routes. `-name.tsx` files are route-scoped and ignored by the router. Co-locate aggressively; lift to `src/lib/` or `src/components/` only when a 2nd route consumes it.
- `src/components/ui/` — Catalyst kit. `src/components/` — app-specific composed components.
- `src/lib/` — cross-cutting client utilities and shared domain types (e.g. `spans.ts`).
- `src/server/` — server-only code: ingest mappers, future API handlers.
- `src/db/` — Drizzle schema + client. `src/integrations/` — framework wiring (tanstack-query).

## Product Map

Optimize for tokens: use this map before broad searches.

- App shell/nav lives in `src/components/application-layout.tsx`.
- `/` Home shows "what's new/weird": new MCP tools, new agents, and anomaly entry points.
- `/sessions` lists agent sessions with time range, search, status filters, cost/tokens, and opens `TraceDrawer`.
- `/sessions/$sessionId` is the session detail page for a single session.
- `/live` is the live traces landing page; `/live/$runId` shows a trace conversation with `ConversationView` and `ContextWindow`.
- `/mcp` lists MCP servers, owners, tool counts, findings, and fetch status.
- `/evals` is currently an empty-state placeholder.
- `/inbox` lists alerts with snooze/dismiss actions and links back to sessions/traces.
- `/palette` is the visual/component preview route; it may have active design edits.

Key trace UI:

- `src/components/trace-drawer.tsx` is the right-side trace drawer used from the sessions list.
- The drawer hides plain `http` transport spans, reparents children upward, and aggregates subtree tokens/cost.
- Trace span/domain helpers live in `src/lib/spans.ts`; shared formatting lives in `src/lib/format.ts`.
