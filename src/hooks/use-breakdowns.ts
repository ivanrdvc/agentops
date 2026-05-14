import { useQuery } from '@tanstack/react-query'
import type { Span } from '#/lib/spans'
import { type ChatBreakdown, emptyBreakdown, fetchBreakdowns, sumBreakdowns } from '#/lib/tokens'

export function useBreakdowns(chatSpans: Span[]): { ready: boolean; total: ChatBreakdown } {
  const ids = chatSpans.map((s) => s.id).join(',')

  const { data, isPending } = useQuery({
    queryKey: ['breakdowns', ids],
    queryFn: () =>
      fetchBreakdowns({
        data: chatSpans.map(({ model, llmInput, inputTokens, outputTokens, cachedTokens, toolDefinitions }) => ({
          model,
          llmInput,
          inputTokens,
          outputTokens,
          cachedTokens,
          toolDefinitions,
        })),
      }),
    enabled: chatSpans.length > 0,
    staleTime: Infinity,
  })

  return {
    ready: !isPending,
    total: data ? sumBreakdowns(data) : emptyBreakdown(),
  }
}
