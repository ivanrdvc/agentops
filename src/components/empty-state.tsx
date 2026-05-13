import type { ComponentType, ReactNode, SVGProps } from 'react'

interface EmptyStateProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        {Icon && (
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-500/10 dark:bg-accent-400/10">
            <Icon className="size-5 text-accent-600 dark:text-accent-400" />
          </div>
        )}
        <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h2>
        {description && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}
