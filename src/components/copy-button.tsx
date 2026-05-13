import { CheckIcon, ClipboardIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

interface CopyButtonProps {
  value: string
  className?: string
  label?: string
}

export function CopyButton({ value, className, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard unavailable (e.g. http://). Fail silently — nothing to recover.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className={[
        'inline-flex size-5 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white',
        className ?? '',
      ].join(' ')}
    >
      {copied ? <CheckIcon className="size-3" /> : <ClipboardIcon className="size-3" />}
    </button>
  )
}
