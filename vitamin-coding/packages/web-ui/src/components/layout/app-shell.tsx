import { Box, Burger, Drawer, ScrollArea } from '@mantine/core'
import { Outlet, useParams } from 'react-router-dom'
import { AppLayout } from '@vitamin/ui-kit'
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

  const sidebarContent = <Sidebar activeSessionId={sessionId} />
  const asideContent = <RightPanel agentId="demo-agent" sessionId={sessionId} />

  return (
    <>
      <AppLayout
        header={<Header />}
        navbar={isMobile ? <Box /> : sidebarContent}
        aside={isMobile || !rightPanelOpen ? undefined : asideContent}
        footer={<StatusBar model={defaultModelId} connected />}
        asideCollapsed={!rightPanelOpen}
      >
        <Box p="md" style={{ minHeight: 'calc(100vh - 56px)' }}>
          {(isTablet || isMobile) ? (
            <Box mb="xs" style={{ display: 'flex', gap: 8 }}>
              <Burger opened={leftSidebarOpen} onClick={toggleLeftSidebar} size="sm" aria-label="Toggle sidebar" />
              <Burger opened={rightPanelOpen} onClick={toggleRightPanel} size="sm" aria-label="Toggle panel" />
            </Box>
          ) : null}
          <Outlet />
        </Box>
      </AppLayout>

      <Drawer opened={isMobile && leftSidebarOpen} onClose={toggleLeftSidebar} title="Sessions" position="left" size="xs">
        <ScrollArea h="100%">
          {sidebarContent}
        </ScrollArea>
      </Drawer>

      <Drawer opened={isMobile && rightPanelOpen} onClose={toggleRightPanel} title="Panel" position="right" size="md">
        {asideContent}
      </Drawer>
    </>
  )
}
