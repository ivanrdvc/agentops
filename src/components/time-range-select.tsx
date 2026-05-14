import { CheckIcon, ChevronDownIcon } from '@heroicons/react/16/solid'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownShortcut,
} from '#/components/ui/dropdown'
import { TIME_RANGE_DAYS, type TimeRangeDays, timeRangeLabel, timeRangeShortcut } from '#/lib/time-range'

interface TimeRangeSelectProps {
  value: TimeRangeDays
  onChange: (value: TimeRangeDays) => void
  options?: readonly TimeRangeDays[]
}

export function TimeRangeSelect({ value, onChange, options = TIME_RANGE_DAYS }: TimeRangeSelectProps) {
  return (
    <div className="my-0 max-w-full overflow-x-auto">
      <Dropdown>
        <DropdownButton
          as="button"
          className="inline-flex h-8 w-fit items-center justify-start gap-2 rounded-md border border-zinc-950/10 bg-transparent px-3 py-1 text-left text-sm font-normal whitespace-nowrap text-zinc-950 transition-colors hover:bg-zinc-950/[0.03] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500/80 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/[0.06] dark:focus-visible:ring-accent-400/80"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-5 min-w-10 rounded bg-zinc-950/[0.06] px-1.5 text-center text-xs/5 tabular-nums text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300">
              {timeRangeShortcut(value)}
            </span>
            <span>{timeRangeLabel(value)}</span>
          </span>
          <ChevronDownIcon data-slot="icon" className="opacity-50" />
        </DropdownButton>
        <DropdownMenu anchor="bottom end" className="min-w-44">
          {options.map((days) => (
            <DropdownItem key={days} onClick={() => onChange(days)}>
              {value === days ? <CheckIcon data-slot="icon" /> : <span data-slot="icon" />}
              <DropdownLabel>{timeRangeLabel(days)}</DropdownLabel>
              <DropdownShortcut keys={timeRangeShortcut(days)} />
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}
