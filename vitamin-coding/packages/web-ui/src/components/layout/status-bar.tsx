import { Group, Text } from '@mantine/core'

interface StatusBarProps {
  model: string
  connected: boolean
}

export function StatusBar(props: StatusBarProps) {
  return (
    <Group h="100%" justify="space-between" px="md">
      <Text size="xs" c="dimmed">模型: {props.model}</Text>
      <Text size="xs" c={props.connected ? 'green' : 'red'}>
        {props.connected ? '已连接' : '未连接'}
      </Text>
    </Group>
  )
}
