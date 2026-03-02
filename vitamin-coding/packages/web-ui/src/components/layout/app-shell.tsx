import { AppShell, Box, Burger, Drawer, ScrollArea } from '@mantine/core'
import { Outlet, useParams } from 'react-router-dom'
import { useResponsive } from '../../hooks/use-responsive'
import { useSettingsStore } from '../../stores/settings-store'
import { useUiStore } from '../../stores/ui-store'
import { RightPanel } from '../panel/right-panel'
import { Sidebar } from '../sidebar/sidebar'
import { Header } from './header'
import { StatusBar } from './status-bar'

export function AppShellLayout() {
  const { isMobile, isTablet } = useResponsive()
  const params = useParams<{ sessionId?: string }>()
  const { leftSidebarOpen, toggleLeftSidebar, rightPanelOpen, toggleRightPanel } = useUiStore()
  const { defaultModelId } = useSettingsStore()
  const sessionId = params.sessionId ?? null

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={isMobile ? undefined : { width: 240, breakpoint: 'md' }}
      aside={isMobile || !rightPanelOpen ? undefined : { width: 320, breakpoint: 'xl' }}
      footer={{ height: 28 }}
      padding="md"
    >
      <AppShell.Header>
        <Header />
      </AppShell.Header>

      {isMobile ? null : (
        <AppShell.Navbar p="xs">
          <Sidebar activeSessionId={sessionId} />
        </AppShell.Navbar>
      )}

      {isMobile || !rightPanelOpen ? null : (
        <AppShell.Aside p="xs">
          <RightPanel agentId="demo-agent" sessionId={sessionId} />
        </AppShell.Aside>
      )}

      <AppShell.Main>
        <Box style={{ minHeight: 'calc(100vh - 56px)' }}>
          {(isTablet || isMobile) ? (
            <Box mb="xs" style={{ display: 'flex', gap: 8 }}>
              <Burger opened={leftSidebarOpen} onClick={toggleLeftSidebar} size="sm" aria-label="切换侧栏" />
              <Burger opened={rightPanelOpen} onClick={toggleRightPanel} size="sm" aria-label="切换右侧栏" />
            </Box>
          ) : null}
          <Outlet />
        </Box>
      </AppShell.Main>

      <AppShell.Footer>
        <StatusBar model={defaultModelId} connected />
      </AppShell.Footer>

      <Drawer opened={isMobile && leftSidebarOpen} onClose={toggleLeftSidebar} title="会话" position="left" size="xs">
        <ScrollArea h="100%">
          <Sidebar activeSessionId={sessionId} />
        </ScrollArea>
      </Drawer>

      <Drawer opened={isMobile && rightPanelOpen} onClose={toggleRightPanel} title="面板" position="right" size="md">
        <RightPanel agentId="demo-agent" sessionId={sessionId} />
      </Drawer>
    </AppShell>
  )
}
