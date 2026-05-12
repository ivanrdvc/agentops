# agentops

"TODO" means the root `TODO.md` — read it, append entries there when relevant.

## Layout

- `src/routes/` — file-based routes. `-name.tsx` files are route-scoped and ignored by the router. Co-locate aggressively; lift to `src/lib/` or `src/components/` only when a 2nd route consumes it.
- `src/components/ui/` — Catalyst kit. `src/components/` — app-specific composed components.
- `src/lib/` — cross-cutting client utilities and shared domain types (e.g. `spans.ts`).
- `src/server/` — server-only code: ingest mappers, future API handlers.
- `src/db/` — Drizzle schema + client. `src/integrations/` — framework wiring (tanstack-query).
