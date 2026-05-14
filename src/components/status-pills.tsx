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
    <div className="inline-flex h-8 rounded-md border border-zinc-950/10 bg-white p-px text-xs shadow-xs dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => !o.disabled && onChange(o.value)}
          disabled={o.disabled}
          title={o.title}
          className={[
            'h-7 rounded px-2.5 font-medium whitespace-nowrap transition-colors',
            o.disabled
              ? 'cursor-not-allowed text-zinc-400 dark:text-zinc-600'
              : value === o.value
                ? 'cursor-pointer bg-zinc-950/[0.06] text-zinc-950 dark:bg-white/[0.12] dark:text-white'
                : 'cursor-pointer text-zinc-600 hover:bg-zinc-950/[0.03] hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
