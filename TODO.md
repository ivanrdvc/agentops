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
- Establish a proper color palette. Tailwind config may be overriding `zinc`
  (renders red-purple-ish), and current accents (indigo/violet/amber/emerald/
  rose) are overloaded between "status meaning" and "directional/category".
  Decide:
    - the canonical neutral
    - one accent per status (selected / pending / success / error)
    - one accent for sub-agent boundary
    - a separate non-status pair for directional metadata (e.g. token in/out)
  Then sweep components to align.
