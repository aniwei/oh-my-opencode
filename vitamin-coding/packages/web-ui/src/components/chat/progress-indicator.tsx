import { Progress, Stack, Text } from '@mantine/core'

interface ProgressIndicatorProps {
  total: number
  done: number
}

export function ProgressIndicator(props: ProgressIndicatorProps) {
  const ratio = props.total === 0 ? 0 : (props.done / props.total) * 100

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">当前进度 {props.done}/{props.total}</Text>
      <Progress value={ratio} />
    </Stack>
  )
}
