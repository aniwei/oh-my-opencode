import { useState } from 'react'
import {
  ActionIcon,
  Box,
  Tooltip,
  useMantineTheme,
} from '@mantine/core'
import {
  AppLayout,
  NavSidebar,
  PageHeader,
  type VitaminColorTokens,
} from '@vitamin/ui-kit'
import { SessionExplorer } from './components/session-explorer'
import { AgentMonitor } from './components/agent-monitor'
import { LogsConsole } from './components/logs-console'
import { MessageInspector } from './components/message-inspector'
import { ThinkingLog } from './components/thinking-log'
import { ToolsTimeline } from './components/tools-timeline'

const NAV_ITEMS = [
  { id: 'sessions', label: 'Sessions', icon: 'S' },
  { id: 'monitor', label: 'Monitor', icon: 'M' },
  { id: 'messages', label: 'Messages', icon: 'I' },
  { id: 'thinking', label: 'Thinking', icon: 'T' },
  { id: 'tools', label: 'Tools', icon: 'L' },
  { id: 'logs', label: 'Logs', icon: 'C' },
] as const

type PanelId = typeof NAV_ITEMS[number]['id']

function NavIcon({ letter }: { letter: string }) {
  return (
    <Box
      style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 4,
        background: 'var(--mantine-primary-color-light)',
        color: 'var(--mantine-primary-color-filled)',
      }}
    >
      {letter}
    </Box>
  )
}

function PanelContent({ activePanel }: { activePanel: PanelId }) {
  switch (activePanel) {
    case 'sessions':
      return <SessionExplorer />
    case 'monitor':
      return <AgentMonitor />
    case 'messages':
      return <MessageInspector />
    case 'thinking':
      return <ThinkingLog />
    case 'tools':
      return <ToolsTimeline />
    case 'logs':
      return <LogsConsole />
  }
}

export function App() {
  const [activePanel, setActivePanel] = useState<PanelId>('sessions')
  const [navCollapsed, setNavCollapsed] = useState(false)
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const header = (
    <PageHeader
      title="Vitamin DevTools"
      actions={
        <Tooltip label="Refresh">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => window.location.reload()}
            style={{ color: tokens.text.tertiary }}
          >
            R
          </ActionIcon>
        </Tooltip>
      }
    />
  )

  const navbar = (
    <NavSidebar
      collapsed={navCollapsed}
      onToggleCollapse={() => setNavCollapsed((v) => !v)}
      bottomItems={NAV_ITEMS.filter((n) => n.id === 'logs').map((n) => ({
        id: n.id,
        label: n.label,
        icon: <NavIcon letter={n.icon} />,
        onClick: () => setActivePanel(n.id),
      }))}
      activeBottomItem={activePanel === 'logs' ? 'logs' : undefined}
    >
      {NAV_ITEMS.filter((n) => n.id !== 'logs').map((item) => {
        const isActive = activePanel === item.id
        return (
          <Box
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: theme.radius.md,
              cursor: 'pointer',
              background: isActive ? tokens.state.accentHover : 'transparent',
              color: isActive ? tokens.brand[500] : tokens.text.secondary,
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              transition: 'background 150ms ease',
            }}
          >
            <NavIcon letter={item.icon} />
            {!navCollapsed && item.label}
          </Box>
        )
      })}
    </NavSidebar>
  )

  return (
    <AppLayout
      header={header}
      navbar={navbar}
      navbarWidth={220}
      navbarCollapsed={navCollapsed}
    >
      <Box p="md" style={{ height: 'calc(100vh - 56px)', overflow: 'auto' }}>
        <PanelContent activePanel={activePanel} />
      </Box>
    </AppLayout>
  )
}
