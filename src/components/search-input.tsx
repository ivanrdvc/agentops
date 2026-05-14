import { MagnifyingGlassIcon } from '@heroicons/react/16/solid'
import { InputGroup } from '#/components/ui/input'

interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="w-full min-w-0 sm:w-64">
      <InputGroup>
        <MagnifyingGlassIcon data-slot="icon" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 w-full rounded-md border border-zinc-950/10 bg-white px-2.5 py-1.5 pl-8 text-sm/5 text-zinc-950 shadow-xs placeholder:text-zinc-500 transition-colors hover:border-zinc-950/20 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500/80 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:shadow-none dark:placeholder:text-zinc-500 dark:hover:border-white/20 dark:focus-visible:ring-accent-400/80"
        />
      </InputGroup>
    </div>
  )
}
