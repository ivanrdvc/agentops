interface Option<T extends string> {
  value: T
  label: string
  disabled?: boolean
  title?: string
}

interface StatusPillsProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
}

export function StatusPills<T extends string>({ value, onChange, options }: StatusPillsProps<T>) {
  return (
    <div className="inline-flex rounded-md border border-zinc-950/10 p-0.5 text-xs dark:border-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => !o.disabled && onChange(o.value)}
          disabled={o.disabled}
          title={o.title}
          className={[
            'rounded px-2.5 py-0.5 font-medium transition-colors',
            o.disabled
              ? 'cursor-not-allowed text-zinc-400 dark:text-zinc-600'
              : value === o.value
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
