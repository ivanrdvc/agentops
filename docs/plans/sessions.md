# TODO — Sessions

A **session** is the ongoing exchange of `user` / `assistant` / `tool` / `system` messages between someone and an agent. It's the data we care about most — the conversation itself. OTel sits on top as the telemetry layer that carries the messages (and the runs that produced them) into agentops.

## Session vs run — settled

- **Session** — the message history. An ordered list of `user`, `assistant`, `tool`, `system` messages produced and consumed by an agent over time, identified by `session.id` (OTel GenAI semconv). The durable, primary thing.
- **Run** — one OTel-traced execution that added to or acted within a session. A session has many runs; a single run typically contributes one assistant turn (often with tool calls) in response to one user message.

Sessions are the primary primitive for chat-style agents. Runs are the execution wrapper around each turn. For one-shot agents (no `session.id` on the span), the session concept doesn't surface at all — runs stand alone.

## Data source — OTel GenAI semconv

Messages arrive as span events on the runs we already ingest:

- `gen_ai.user.message`
- `gen_ai.system.message`
- `gen_ai.assistant.message` (carries tool call args)
- `gen_ai.tool.message` (tool result, linked via `tool_call_id`)
- `gen_ai.choice` (final response)

Grouping key: `session.id` attribute on the parent span. Within a session, messages are ordered by event timestamp.

We index these events into our own tables so the conversation view doesn't require re-querying every underlying trace every page load — and so the conversation survives the provider retiring those traces.

## Open questions (decide first)

### 1. Session identity across providers

Runs for one session may land in OpenObserve, App Insights, and future backends. The OTel `session.id` is the spine — it's a standard GenAI semconv attribute, set by users or their agent SDK on every span. Sessions assembled from different providers' traces merge cleanly on this key.

Fallback: heuristic matching (same user + same agent + temporal adjacency) as a *suggested* merge in UI, never a silent join.

### 2. Message storage scope

We store messages ourselves so the conversation view survives provider retention drops. Open: how much do we keep?

- **A. Headers only** — role, timestamp, span pointer; content fetched from provider on demand. Dies when the provider ages out the span.
- **B. Full content mirror** — role, timestamp, content, tool_calls, tool_results. Conversation renders without touching the provider.

Recommend **B**. Message content is small text, durability is the whole point, and chat UIs are awful when half the messages are "click to load."

### 3. Tool-call linkage

A single assistant message often produces multiple tool calls, each with a matching tool message. Schema needs to preserve `tool_call_id` linkage so the UI can nest tool calls/results under the right assistant turn.

### 4. UI shape

- `/sessions` — list, sorted by last activity, title (first user message or supplied), message count, providers represented.
- `/sessions/$id` — chat-style transcript: bubbles for user/assistant, collapsible tool call/result blocks nested under the assistant turn they belong to. Click any message → opens the underlying run/span.
- Header crumb on `/runs/$runId`: "part of session X · N messages" — only when the run has a `session.id`.
- Runs with no `session.id`: no crumb, no extra UI. We don't pretend every run is a session.

### 5. When does a session get created?

- On ingest, if `session.id` is on a span: upsert the session, append any `gen_ai.*.message` events on that span to `session_messages` ordered by event time.
- On user action in UI (manual merge of runs into a session): later, after the explicit-key path is solid.
- Open: do we honor user-supplied session metadata (title, etc.) if a span carries `session.title` or similar? Default: first user message becomes the title until overridden.

### 6. Retention & tombstones

- Sessions and their messages live in our DB and outlive the underlying provider trace. The session row is durable; the deep link to the original span may dead-end.
- Show a "trace retired by provider" tombstone state on messages whose source span is gone — not a 404.

## Build steps (rough — depend on answers above)

- [ ] Lock in Q1 (identity), Q2 (storage scope = likely B), Q3 (tool-call linkage).
- [ ] Schema: `sessions(id, project_id, title, first_seen, last_seen, message_count)`, `session_messages(id, session_id, run_id, role, content jsonb, tool_call_id?, tool_calls jsonb?, event_ts, span_id, provider, provider_trace_id)`.
- [ ] Ingest hook: for each span with `session.id`, upsert session + append matching `gen_ai.*.message` events.
- [ ] `/sessions` list page.
- [ ] `/sessions/$id` chat-style transcript with tool calls/results nested under assistant turns.
- [ ] Run detail crumb back to session (only when applicable).
- [ ] Tombstone state for messages whose underlying span has aged out on the provider.
- [ ] Heuristic merge suggestions panel — only after explicit-key path is solid.

## Non-goals (v1)

- Surfacing a session for every run. One-shot agents (no `session.id`) don't see session UI.
- Authoring or editing messages in agentops. Read-only.
- Inferring `session.id` from message content. Either it's on the span or it isn't.
- Cross-provider auto-join via heuristic alone, without user confirmation.
- Comparing two sessions side-by-side. Defer; revisit alongside `docs/plans/compare-runs.md`.
- Real-time streaming of session updates. Refresh-on-load is fine for v1.
