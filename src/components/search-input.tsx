interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-0 rounded-md border border-zinc-950/10 bg-transparent px-2.5 py-1 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950/30 focus:outline-none sm:w-64 dark:border-white/10 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white/30"
    />
  )
}
