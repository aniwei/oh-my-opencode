import { Group, Text, useMantineTheme } from '@mantine/core'
import type { VitaminColorTokens } from '@vitamin/ui-kit'

interface StatusBarProps {
  model: string
  connected: boolean
}

export function StatusBar(props: StatusBarProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Group h="100%" justify="space-between" px="md">
      <Text size="xs" style={{ color: tokens.text.tertiary }}>
        Model: {props.model}
      </Text>
      <Group gap={6} align="center">
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: props.connected
              ? tokens.status.successBg
              : tokens.status.errorBg,
          }}
        />
        <Text
          size="xs"
          style={{
            color: props.connected
              ? tokens.text.success
              : tokens.text.destructive,
          }}
        >
          {props.connected ? 'Connected' : 'Disconnected'}
        </Text>
      </Group>
    </Group>
  )
}
