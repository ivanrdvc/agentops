# TODO

## Feats
- Sessions — `docs/plans/sessions.md`
- Evals — `docs/plans/evals.md`
- Compare two runs side-by-side — `docs/plans/compare-runs.md`
- MCP — `docs/plans/mcp.md`
- HTTP API for LLM debugging — `docs/plans/http-api.md`
- Live ingest — spans appear in the viewer as they flush from the agent's
  OTel exporter. Granularity is one span (turn / tool call), not tokens;
  token-by-token streaming is out of scope (would require a side channel
  that bypasses OTel and violates the read-only / OTel-first stance).
- Historic data across agent versions (compare runs over time)

## Polish
- Trace drawer is the primary session surface from the list; full session route stays Turns + Conversation without a separate Spans/Tree column.
- Apply palette — see `docs/plans/palette.md`. Live preview at `/palette`.
  Sweep list is in the doc (~6 files). Zinc's purple-magenta tint is stock
  Tailwind v4 (hue 285°), not a config override — we lean into it.
