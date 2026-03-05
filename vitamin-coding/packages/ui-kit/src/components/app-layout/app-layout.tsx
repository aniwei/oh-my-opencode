import { AppShell, useMantineTheme } from '@mantine/core'
import type { ReactNode } from 'react'
import type { VitaminColorTokens } from '../../tokens/colors'

interface AppLayoutProps {
  header: ReactNode
  navbar: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  children: ReactNode
  navbarWidth?: number
  asideWidth?: number
  navbarCollapsed?: boolean
  asideCollapsed?: boolean
}

export function AppLayout(props: AppLayoutProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const navWidth = props.navbarCollapsed ? 60 : (props.navbarWidth ?? 240)
  const asideWidth = props.asideWidth ?? 320
  const showAside = props.aside !== undefined && !props.asideCollapsed

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: navWidth, breakpoint: 'sm' }}
      aside={showAside ? { width: asideWidth, breakpoint: 'lg' } : undefined}
      footer={props.footer ? { height: 28 } : undefined}
      styles={{
        root: {
          minHeight: '100vh',
        },
        main: {
          background: tokens.bg.body,
          minHeight: '100vh',
        },
        navbar: {
          background: tokens.nav.bg,
          backdropFilter: 'blur(12px)',
          borderRight: `1px solid ${tokens.divider.subtle}`,
          transition: 'width 200ms ease',
        },
        header: {
          background: tokens.panel.bg,
          borderBottom: `1px solid ${tokens.divider.regular}`,
          backdropFilter: 'blur(12px)',
        },
        aside: {
          background: tokens.panel.bg,
          borderLeft: `1px solid ${tokens.divider.subtle}`,
        },
        footer: {
          background: tokens.panel.bg,
          borderTop: `1px solid ${tokens.divider.subtle}`,
        },
      }}
    >
      <AppShell.Header>{props.header}</AppShell.Header>
      <AppShell.Navbar p="xs">{props.navbar}</AppShell.Navbar>
      {showAside ? (
        <AppShell.Aside p="xs">{props.aside}</AppShell.Aside>
      ) : null}
      <AppShell.Main>{props.children}</AppShell.Main>
      {props.footer ? (
        <AppShell.Footer>{props.footer}</AppShell.Footer>
      ) : null}
    </AppShell>
  )
}
