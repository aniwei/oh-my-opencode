import { Group, Stack, Text } from '@mantine/core'
import { formatTokenCount, estimateCost, formatCost } from '../../utils/format-token'

interface TokenStatsProps {
  inputTokens: number
  outputTokens: number
  modelId?: string
}

export function TokenStats(props: TokenStatsProps) {
  const total = props.inputTokens + props.outputTokens
  const cost = estimateCost(props.inputTokens, props.outputTokens, props.modelId)

  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Text size="sm">Token 统计</Text>
        <Text c="dimmed" size="xs">{formatCost(cost)}</Text>
      </Group>
      <Group justify="space-between">
        <Text c="dimmed" size="xs">输入: {formatTokenCount(props.inputTokens)}</Text>
        <Text c="dimmed" size="xs">输出: {formatTokenCount(props.outputTokens)}</Text>
        <Text c="dimmed" size="xs">总计: {formatTokenCount(total)}</Text>
      </Group>
    </Stack>
  )
}
