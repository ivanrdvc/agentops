import type { ComponentType, ReactNode, SVGProps } from 'react'

interface EmptyStateProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description?: ReactNode
  action?: ReactNode
  /** Wrap the empty state in the standard rounded-card panel. */
  panel?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, panel = false }: EmptyStateProps) {
  const outerClasses = panel
    ? 'flex flex-1 items-center justify-center rounded-xl border border-zinc-950/5 bg-white px-6 py-16 dark:border-white/8 dark:bg-zinc-900'
    : 'flex flex-1 items-center justify-center px-6 py-16'
  return (
    <div className={outerClasses}>
      <div className="w-full max-w-md text-center">
        {Icon && (
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-accent-500/10 ring-8 ring-accent-500/5 dark:bg-accent-400/10 dark:ring-accent-400/5">
            <Icon className="size-6 text-accent-600 dark:text-accent-400" />
          </div>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h2>
        {description && (
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
        {action && <div className="mt-6 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}
