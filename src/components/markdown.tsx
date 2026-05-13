import { memo } from 'react'
import { Streamdown } from 'streamdown'

interface MarkdownProps {
  children: string
  className?: string
}

// Thin wrapper over Streamdown. Tightens the default block spacing for the
// dense conversation bubbles and uses our zinc palette.
export const Markdown = memo(function Markdown({ children, className }: MarkdownProps) {
  return (
    <Streamdown
      parseIncompleteMarkdown={false}
      shikiTheme={['github-light', 'github-dark']}
      className={[
        'streamdown-tight break-words text-xs leading-snug text-zinc-950 dark:text-white',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </Streamdown>
  )
})
