import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
  MoonIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/16/solid'
import {
  BeakerIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  HomeIcon,
  InboxIcon,
  PlayCircleIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/20/solid'
import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { Logo } from '#/components/logo'
import { SettingsDialog } from '#/components/settings-dialog'
import { Avatar } from '#/components/ui/avatar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '#/components/ui/dropdown'
import { Navbar, NavbarSection, NavbarSpacer } from '#/components/ui/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '#/components/ui/sidebar'
import { SidebarLayout } from '#/components/ui/sidebar-layout'
import { useTheme } from '#/hooks/use-theme'
import { useUser } from '#/hooks/use-user'
import { inboxUnreadCountQuery } from '#/routes/inbox/-data'

const APP_VERSION = 'v0.1.0'

const recentRuns = [
  { id: '1', name: 'code-review · #4821', url: '/sessions/4821' },
  { id: '2', name: 'lead-qualifier · #182', url: '/sessions/182' },
]

function AccountDropdownMenu({ anchor }: { anchor: 'top start' | 'bottom end' }) {
  const { mode, toggle } = useTheme()
  const ThemeIcon = mode === 'dark' ? MoonIcon : SunIcon

  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/account">
        <UserCircleIcon />
        <DropdownLabel>My account</DropdownLabel>
      </DropdownItem>
      <DropdownItem onClick={toggle}>
        <ThemeIcon />
        <DropdownLabel>Toggle theme</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="/login">
        <ArrowRightStartOnRectangleIcon />
        <DropdownLabel>Sign out</DropdownLabel>
      </DropdownItem>
    </DropdownMenu>
  )
}

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const is = (path: string) => pathname.startsWith(path)
  const user = useUser()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data: unreadCount = 0 } = useQuery(inboxUnreadCountQuery())

  return (
    <>
      <SettingsDialog open={settingsOpen} onClose={setSettingsOpen} />
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection>
              <Dropdown>
                <DropdownButton plain aria-label="Account">
                  <Avatar initials={user.initials} square />
                </DropdownButton>
                <AccountDropdownMenu anchor="bottom end" />
              </Dropdown>
            </NavbarSection>
          </Navbar>
        }
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <Logo />
                  <SidebarLabel>agentops</SidebarLabel>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px]/4 font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {APP_VERSION}
                  </span>
                  <ChevronDownIcon />
                </DropdownButton>
                <DropdownMenu className="min-w-80 lg:min-w-64" anchor="bottom start">
                  <DropdownItem onClick={() => setSettingsOpen(true)}>
                    <Cog8ToothIcon />
                    <DropdownLabel>Settings</DropdownLabel>
                  </DropdownItem>
                  <DropdownDivider />
                  <DropdownItem href="/workspace">
                    <Logo slot="icon" />
                    <DropdownLabel>agentops</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </SidebarHeader>

            <SidebarBody>
              <SidebarSection>
                <SidebarItem href="/" current={pathname === '/'}>
                  <HomeIcon />
                  <SidebarLabel>Home</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="/sessions" current={is('/sessions')}>
                  <ChatBubbleLeftRightIcon />
                  <SidebarLabel>Sessions</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="/live" current={is('/live')}>
                  <PlayCircleIcon />
                  <SidebarLabel>Live</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="/mcp" current={is('/mcp')}>
                  <PuzzlePieceIcon />
                  <SidebarLabel>MCP</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="/evals" current={is('/evals')}>
                  <BeakerIcon />
                  <SidebarLabel>Evals</SidebarLabel>
                </SidebarItem>
              </SidebarSection>

              <SidebarSection className="max-lg:hidden">
                <SidebarHeading>Recent</SidebarHeading>
                {recentRuns.map((run) => (
                  <SidebarItem key={run.id} href={run.url}>
                    {run.name}
                  </SidebarItem>
                ))}
              </SidebarSection>

              <SidebarSpacer />

              <SidebarSection>
                <SidebarItem onClick={() => setSettingsOpen(true)}>
                  <Cog6ToothIcon />
                  <SidebarLabel>Settings</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="/inbox" current={is('/inbox')}>
                  <span data-slot="icon" className="relative">
                    <InboxIcon className="size-full" />
                    {unreadCount > 0 && (
                      <span className="pointer-events-none absolute top-0 right-0 flex min-w-3.5 translate-x-1/3 -translate-y-1/3 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                        <span className="relative inline-flex min-w-3.5 rounded-full bg-rose-500 px-1 text-center text-[9px]/3.5 font-semibold text-white shadow-sm">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      </span>
                    )}
                  </span>
                  <SidebarLabel>Inbox</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
            </SidebarBody>

            <SidebarFooter className="max-lg:hidden">
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar initials={user.initials} className="size-10 bg-zinc-900 text-white" square />
                    <span className="min-w-0">
                      <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {user.email}
                      </span>
                    </span>
                  </span>
                  <ChevronUpIcon />
                </DropdownButton>
                <AccountDropdownMenu anchor="top start" />
              </Dropdown>
            </SidebarFooter>
          </Sidebar>
        }
      >
        {children}
      </SidebarLayout>
    </>
  )
}
