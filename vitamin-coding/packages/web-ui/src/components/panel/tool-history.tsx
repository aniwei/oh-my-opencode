import { Badge, Group, List, Text } from '@mantine/core'
import { formatDuration } from '../../utils/format-time'

interface ToolHistoryItem {
  id: string
  name: string
  status: string
  durationMs?: number
}

interface ToolHistoryProps {
  items: ToolHistoryItem[]
}

const STATUS_COLOR: Record<string, string> = {
  running: 'blue',
  success: 'green',
  error: 'red',
  pending: 'gray',
}

export function ToolHistory(props: ToolHistoryProps) {
  if (props.items.length === 0) {
    return <Text c="dimmed" size="sm">暂无工具调用</Text>
  }

  return (
    <List size="sm" spacing={4}>
      {props.items.map((item) => (
        <List.Item key={item.id}>
          <Group gap="xs" wrap="nowrap">
            <Badge size="xs" color={STATUS_COLOR[item.status] ?? 'gray'} variant="light">
              {item.status}
            </Badge>
            <Text size="xs">{item.name}</Text>
            {item.durationMs !== undefined ? (
              <Text c="dimmed" size="xs">{formatDuration(item.durationMs)}</Text>
            ) : null}
          </Group>
        </List.Item>
      ))}
    </List>
  )
}
