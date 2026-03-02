import { Tabs } from '@mantine/core'
import { useUiStore } from '../../stores/ui-store'
import { AgentPanel } from './agent-panel'
import { FilePanel } from './file-panel'

interface RightPanelProps {
  agentId: string
  sessionId?: string | null
}

export function RightPanel(props: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab } = useUiStore()

  return (
    <Tabs value={rightPanelTab} onChange={(value) => setRightPanelTab((value as 'files' | 'agent') ?? 'files')}>
      <Tabs.List>
        <Tabs.Tab value="files">文件</Tabs.Tab>
        <Tabs.Tab value="agent">Agent</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="files" pt="xs">
        <FilePanel sessionId={props.sessionId} />
      </Tabs.Panel>
      <Tabs.Panel value="agent" pt="xs">
        <AgentPanel agentId={props.agentId} />
      </Tabs.Panel>
    </Tabs>
  )
}
