import { useEffect, useState } from 'react'
import type { Span } from '#/lib/spans'
import { breakdownChat, type ChatBreakdown, emptyBreakdown, sumBreakdowns } from '#/lib/tokens'

export function useBreakdowns(chatSpans: Span[]): { ready: boolean; total: ChatBreakdown } {
  const [ready, setReady] = useState(false)
  const [total, setTotal] = useState<ChatBreakdown>(() => emptyBreakdown())

  useEffect(() => {
    let cancelled = false
    setReady(false)
    Promise.all(chatSpans.map((s) => breakdownChat(s)))
      .then((items) => {
        if (cancelled) return
        setTotal(sumBreakdowns(items))
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [chatSpans])

  return { ready, total }
}
