import { ActionIcon, Group, Text, Tooltip } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../../stores/settings-store'
import { ModelSelector } from '../input/model-selector'

export function Header() {
  const navigate = useNavigate()
  const { defaultModelId, setDefaultModelId, colorScheme, setColorScheme } = useSettingsStore()

  return (
    <Group h="100%" justify="space-between" px="md" wrap="nowrap">
      <Text fw={700} style={{ cursor: 'pointer' }} onClick={() => navigate('/app')}>
        Vitamin Web UI
      </Text>
      <Group gap="xs" wrap="nowrap">
        <ModelSelector value={defaultModelId} onChange={setDefaultModelId} />
        <Tooltip label={colorScheme === 'dark' ? '切换亮色主题' : '切换深色主题'}>
          <ActionIcon
            aria-label="切换主题"
            variant="subtle"
            onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
          >
            {colorScheme === 'dark' ? '☀' : '☾'}
          </ActionIcon>
        </Tooltip>
        <Tooltip label="设置">
          <ActionIcon aria-label="设置" variant="subtle" onClick={() => navigate('/app/settings')}>
            ⚙
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  )
}
