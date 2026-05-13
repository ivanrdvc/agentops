import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { StatusPills } from '#/components/status-pills'
import { Dialog } from '#/components/ui/dialog'
import { type ThemeMode, useTheme } from '#/hooks/use-theme'
import { useUser } from '#/hooks/use-user'
import { providersQuery, setProviderFn } from '#/lib/providers-data'
import { queryKeys } from '#/lib/query-keys'

const APP_VERSION = 'v0.1.0'

type Section = 'general' | 'appearance' | 'account'

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'account', label: 'Account' },
]

interface SettingsDialogProps {
  open: boolean
  onClose: (open: boolean) => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [section, setSection] = useState<Section>('general')

  return (
    <Dialog open={open} onClose={onClose} size="5xl">
      <div className="-m-(--gutter) grid min-h-[28rem] grid-cols-1 sm:min-h-[36rem] sm:grid-cols-[12rem_1fr]">
        <aside className="border-b border-zinc-950/10 px-2 py-3 sm:border-r sm:border-b-0 sm:py-4 dark:border-white/10">
          <div className="px-2 pb-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Settings
          </div>
          <nav className="flex gap-0.5 overflow-x-auto sm:flex-col sm:overflow-visible">
            {SECTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSection(s.value)}
                className={[
                  'rounded px-2 py-1 text-left text-xs font-medium transition-colors',
                  section === s.value
                    ? 'bg-zinc-950/5 text-zinc-950 dark:bg-white/10 dark:text-white'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
                ].join(' ')}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {section === 'general' && <GeneralPane />}
          {section === 'appearance' && <AppearancePane />}
          {section === 'account' && <AccountPane />}
        </div>
      </div>
    </Dialog>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">{children}</h2>
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-xs font-medium text-zinc-950 dark:text-white">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</div>}
      </div>
      <div className="min-w-0 sm:shrink-0">{children}</div>
    </div>
  )
}

function GeneralPane() {
  return (
    <div className="flex flex-col">
      <SectionTitle>General</SectionTitle>
      <div className="mt-3 divide-y divide-zinc-950/5 dark:divide-white/5">
        <Row label="Version">
          <code className="rounded bg-zinc-950/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
            {APP_VERSION}
          </code>
        </Row>
        <ProviderRow />
      </div>
    </div>
  )
}

type ProviderId = 'openobserve' | 'app-insights'

function ProviderRow() {
  const { data } = useQuery(providersQuery())
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: ProviderId) => setProviderFn({ data: id }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.providers.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.sessions.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.traces.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.home.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.inbox.all() }),
      ])
    },
  })

  const providers = data?.providers ?? []
  const active = (data?.active ?? 'openobserve') as ProviderId
  const missing = providers.find((p) => !p.configured)?.missing

  return (
    <Row
      label="Telemetry provider"
      hint={
        missing && missing.length > 0
          ? `Application Insights needs ${missing.join(', ')} in .env.`
          : 'Switch backends without restarting; persisted as a cookie.'
      }
    >
      <StatusPills
        value={active}
        onChange={(next) => {
          if (next !== active && !mutation.isPending) mutation.mutate(next as ProviderId)
        }}
        options={providers.map((p) => ({
          value: p.id,
          label: p.label,
          disabled: !p.configured,
          title: p.configured ? undefined : `Missing env: ${p.missing?.join(', ') ?? ''}`,
        }))}
      />
    </Row>
  )
}

function AppearancePane() {
  const { mode, toggle } = useTheme()
  const options: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]
  return (
    <div className="flex flex-col">
      <SectionTitle>Appearance</SectionTitle>
      <div className="mt-3 divide-y divide-zinc-950/5 dark:divide-white/5">
        <Row label="Theme" hint="Persisted in localStorage.">
          <StatusPills
            value={mode}
            onChange={(next) => {
              if (next !== mode) toggle()
            }}
            options={options}
          />
        </Row>
      </div>
    </div>
  )
}

function AccountPane() {
  const user = useUser()
  return (
    <div className="flex flex-col">
      <SectionTitle>Account</SectionTitle>
      <div className="mt-3 divide-y divide-zinc-950/5 dark:divide-white/5">
        <Row label="Name">
          <span className="text-xs text-zinc-700 dark:text-zinc-300">{user.name}</span>
        </Row>
        <Row label="Email">
          <span className="break-all font-mono text-[11px] text-zinc-700 dark:text-zinc-300">{user.email}</span>
        </Row>
      </div>
    </div>
  )
}
