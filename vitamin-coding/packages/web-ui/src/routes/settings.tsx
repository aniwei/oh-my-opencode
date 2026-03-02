import {
  Divider, Group, Paper, SegmentedControl, Stack, Switch, Text, Title,
} from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../stores/settings-store'
import type { ColorScheme, SendShortcut } from '../stores/settings-store'

export function SettingsPage() {
  const navigate = useNavigate()
  const {
    colorScheme, sendShortcut, defaultModelId,
    setColorScheme, setSendShortcut,
  } = useSettingsStore()

  return (
    <Stack gap="md" maw={600}>
      <Title order={3}>设置</Title>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>外观</Text>
          <Group justify="space-between">
            <Text size="sm">主题模式</Text>
            <SegmentedControl
              size="xs"
              data={[
                { label: '深色', value: 'dark' },
                { label: '浅色', value: 'light' },
              ]}
              value={colorScheme}
              onChange={(value) => setColorScheme(value as ColorScheme)}
            />
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>快捷键</Text>
          <Group justify="space-between">
            <Text size="sm">发送消息</Text>
            <SegmentedControl
              size="xs"
              data={[
                { label: 'Cmd+Enter', value: 'cmd-enter' },
                { label: 'Enter', value: 'enter' },
              ]}
              value={sendShortcut}
              onChange={(value) => setSendShortcut(value as SendShortcut)}
            />
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>模型配置</Text>
          <Group justify="space-between">
            <Text size="sm">默认模型</Text>
            <Text size="sm" c="dimmed">{defaultModelId}</Text>
          </Group>
          <Text
            size="sm"
            c="blue"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/app/settings/models')}
          >
            管理模型配置 →
          </Text>
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>Agent 管理</Text>
          <Text
            size="sm"
            c="blue"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/app/settings/agents')}
          >
            管理 Agent 配置 →
          </Text>
        </Stack>
      </Paper>
    </Stack>
  )
}
