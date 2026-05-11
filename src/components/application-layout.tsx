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
  BoltIcon,
  Cog6ToothIcon,
  CubeTransparentIcon,
  PlayCircleIcon,
} from '@heroicons/react/20/solid'
import { useRouterState } from '@tanstack/react-router'
import { Avatar } from '#/components/avatar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '#/components/dropdown'
import { Navbar, NavbarSection, NavbarSpacer } from '#/components/navbar'
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
} from '#/components/sidebar'
import { SidebarLayout } from '#/components/sidebar-layout'
import { useTheme } from '#/lib/theme'
import { useUser } from '#/lib/user'

const recentRuns = [
  { id: '1', name: 'code-review · #4821', url: '/runs/4821' },
  { id: '2', name: 'lead-qualifier · #182', url: '/runs/182' },
]

function AccountDropdownMenu({
  anchor,
}: {
  anchor: 'top start' | 'bottom end'
}) {
  const { mode, toggle } = useTheme()
  const ThemeIcon = mode === 'dark' ? MoonIcon : SunIcon

  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/account">
        <UserCircleIcon />
        <DropdownLabel>My account</DropdownLabel>
      </DropdownItem>
      <DropdownItem href="/settings">
        <Cog8ToothIcon />
        <DropdownLabel>Settings</DropdownLabel>
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

  return (
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
                <Avatar initials="AO" className="bg-zinc-900 text-white" />
                <SidebarLabel>agentops</SidebarLabel>
                <ChevronDownIcon />
              </DropdownButton>
              <DropdownMenu
                className="min-w-80 lg:min-w-64"
                anchor="bottom start"
              >
                <DropdownItem href="/settings">
                  <Cog8ToothIcon />
                  <DropdownLabel>Settings</DropdownLabel>
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem href="/workspace">
                  <Avatar
                    slot="icon"
                    initials="AO"
                    className="bg-zinc-900 text-white"
                  />
                  <DropdownLabel>agentops</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/agents" current={is('/agents')}>
                <BoltIcon />
                <SidebarLabel>Agents</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/runs" current={is('/runs')}>
                <PlayCircleIcon />
                <SidebarLabel>Runs</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/mcp" current={is('/mcp')}>
                <CubeTransparentIcon />
                <SidebarLabel>MCP</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/evals" current={is('/evals')}>
                <BeakerIcon />
                <SidebarLabel>Evals</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            <SidebarSection className="max-lg:hidden">
              <SidebarHeading>Recent Runs</SidebarHeading>
              {recentRuns.map((run) => (
                <SidebarItem key={run.id} href={run.url}>
                  {run.name}
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem href="/settings">
                <Cog6ToothIcon />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter className="max-lg:hidden">
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar
                    initials={user.initials}
                    className="size-10 bg-zinc-900 text-white"
                    square
                  />
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
  )
}
