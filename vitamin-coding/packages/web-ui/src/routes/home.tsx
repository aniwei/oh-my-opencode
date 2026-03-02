import { Paper, Stack, Text, Title } from '@mantine/core'

export function HomeRoute() {
  return (
    <Paper p="lg" radius="md" withBorder>
      <Stack gap="xs">
        <Title order={3}>欢迎使用 Vitamin Web UI</Title>
        <Text c="dimmed">请选择左侧历史会话，或者点击“新建对话”开始。</Text>
      </Stack>
    </Paper>
  )
}
