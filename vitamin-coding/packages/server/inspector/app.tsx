import React, { useState } from 'react'
import { SessionExplorer } from './components/session-explorer'
import { AgentMonitor } from './components/agent-monitor'
import { LogsConsole } from './components/logs-console'
import { MessageInspector } from './components/message-inspector'
import { ThinkingLog } from './components/thinking-log'
import { ToolsTimeline } from './components/tools-timeline'

const TABS = [
  { id: 'sessions', label: 'Session Explorer' },
  { id: 'monitor', label: 'Agent Monitor' },
  { id: 'messages', label: 'Message Inspector' },
  { id: 'thinking', label: 'Thinking Log' },
  { id: 'tools', label: 'Tools Timeline' },
  { id: 'logs', label: 'Logs Console' },
] as const

type TabId = typeof TABS[number]['id']

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('sessions')
  
  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '16px', background: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '18px' }}>Vitamin DevTools</h1>
        <nav style={{ display: 'flex', gap: '16px' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              style={{ fontWeight: activeTab === tab.id ? 'bold' : 'normal', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px' }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
          {activeTab === 'sessions' && <SessionExplorer />}
          {activeTab === 'monitor' && <AgentMonitor />}
          {activeTab === 'messages' && <MessageInspector />}
          {activeTab === 'thinking' && <ThinkingLog />}
          {activeTab === 'tools' && <ToolsTimeline />}
          {activeTab === 'logs' && <LogsConsole />}
        </div>
      </main>
    </div>
  )
}
