import { findOrchestratorId, findWrappedAgent, formatCost, type Span, subtreeAggregate } from '#/lib/spans'

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
  if (!orchestratorId) {
    return (
      <div className="px-3 py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        No agent invocation found in this run.
      </div>
    )
  }
  const turns = extractTurns(spans, orchestratorId)

  return (
    <ol className="flex flex-col gap-3 p-3">
      {turns.map((turn, i) => (
        <TurnCard
          key={turn.llm.id}
          index={i + 1}
          turn={turn}
          spans={spans}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ol>
  )
}

interface TurnCardProps {
  index: number
  turn: Turn
  spans: Span[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function TurnCard({ index, turn, spans, selectedId, onSelect }: TurnCardProps) {
  const { llm, actions } = turn
  const durationMs = llm.endMs - llm.startMs
  const llmSelected = llm.id === selectedId

  return (
    <li className="rounded-md border border-zinc-950/10 dark:border-white/10">
      {/* Turn header (clickable -> selects the LLM span) */}
      <button
        type="button"
        onClick={() => onSelect(llm.id)}
        className={[
          'flex w-full items-center gap-2 rounded-t-md px-3 py-1.5 text-left text-xs',
          llmSelected ? 'bg-indigo-500/15 dark:bg-indigo-400/15' : 'hover:bg-zinc-100 dark:hover:bg-white/5',
        ].join(' ')}
      >
        <span className="font-semibold text-zinc-950 dark:text-white">Turn {index}</span>
        <span className="text-zinc-500 dark:text-zinc-400">{llm.model ?? 'llm'}</span>
        {actions.length > 0 && (
          <span className="rounded bg-zinc-200 px-1 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {actions.length} action{actions.length === 1 ? '' : 's'}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3 tabular-nums text-zinc-500 dark:text-zinc-400">
          {llm.tokens != null && <span>{llm.tokens} tok</span>}
          {formatCost(llm.costUsd ?? 0) && <span>${formatCost(llm.costUsd ?? 0)}</span>}
          <span>{durationMs}ms</span>
        </span>
      </button>

      {/* Actions taken this turn */}
      {actions.length > 0 ? (
        <ul className="border-t border-zinc-950/5 dark:border-white/5">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              spans={spans}
              selected={a.id === selectedId}
              onSelect={() => onSelect(a.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="border-t border-zinc-950/5 px-3 py-2 text-[11px] italic text-zinc-400 dark:border-white/5 dark:text-zinc-600">
          no actions
        </div>
      )}
    </li>
  )
}

interface ActionRowProps {
  action: Span
  spans: Span[]
  selected: boolean
  onSelect: () => void
}

function ActionRow({ action, spans, selected, onSelect }: ActionRowProps) {
  // A tool span may wrap a sub-agent (execute_tool foo -> invoke_agent X).
  // In that case we present the row as an agent invocation with rolled-up
  // tokens/cost from the entire wrapped subtree.
  const wrappedAgent = action.operation === 'tool' ? findWrappedAgent(spans, action.id) : undefined
  const isAgent = action.operation === 'invoke_agent' || !!wrappedAgent

  const pillLabel = isAgent ? 'agent' : 'tool'
  const pillClass = isAgent
    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'

  const name = wrappedAgent
    ? `${action.toolName ?? action.name} → ${wrappedAgent.agentName ?? wrappedAgent.name}`
    : isAgent
      ? (action.agentName ?? action.name)
      : (action.toolName ?? action.name)

  const agg = isAgent ? subtreeAggregate(spans, action.id) : null

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs',
          selected ? 'bg-indigo-500/15 dark:bg-indigo-400/15' : 'hover:bg-zinc-100 dark:hover:bg-white/5',
        ].join(' ')}
      >
        <span
          className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${pillClass}`}
        >
          {pillLabel}
        </span>
        <span className="shrink-0 font-medium text-zinc-950 dark:text-white">{name}</span>
        {action.inputParams && (
          <span className="min-w-0 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {action.inputParams}
          </span>
        )}
        {agg && (agg.tokens > 0 || agg.costUsd > 0) && (
          <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums text-[11px] text-zinc-500 dark:text-zinc-400">
            {agg.tokens > 0 && <span>Σ {agg.tokens}</span>}
            {formatCost(agg.costUsd) && <span>${formatCost(agg.costUsd)}</span>}
          </span>
        )}
      </button>
    </li>
  )
}
