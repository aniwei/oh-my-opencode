import { Badge, Group, Text } from '@mantine/core'

interface AgentStatusProps {
  state: 'idle' | 'running' | 'error'
}

const COLOR: Record<AgentStatusProps['state'], string> = {
  idle: 'gray',
  running: 'blue',
  error: 'red',
}

export function AgentStatus(props: AgentStatusProps) {
  return (
    <Group justify="space-between">
      <Text fw={600} size="sm">Agent 状态</Text>
      <Badge color={COLOR[props.state]}>{props.state}</Badge>
    </Group>
  )
}
