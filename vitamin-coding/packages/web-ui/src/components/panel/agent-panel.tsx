import { Divider, Stack, Text } from '@mantine/core'
import { useAgentStatus } from '../../hooks/use-agent-status'
import { AgentStatus } from './agent-status'
import { TokenStats } from './token-stats'
import { ToolHistory } from './tool-history'

interface AgentPanelProps {
  agentId: string
}

export function AgentPanel(props: AgentPanelProps) {
  const status = useAgentStatus(props.agentId)

  return (
    <Stack gap="xs">
      <Text fw={700} size="sm">Agent 面板</Text>
      <AgentStatus state={status.state} />
      <Divider />
      <ToolHistory items={status.recentToolCalls} />
      <Divider />
      <TokenStats inputTokens={status.inputTokens} outputTokens={status.outputTokens} />
    </Stack>
  )
}
