import { ActionIcon, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core'
import type { VitaminColorTokens } from '@vitamin/ui-kit'
import type { SessionSummary } from '../../types/api'

interface SessionItemProps {
  session: SessionSummary
  active: boolean
  onSelect: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export function SessionItem(props: SessionItemProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Paper
      onClick={() => props.onSelect(props.session.id)}
      p="xs"
      radius="md"
      style={{
        cursor: 'pointer',
        background: props.active ? tokens.state.accentHover : 'transparent',
        border: props.active
          ? `1px solid ${tokens.brand[500]}`
          : `1px solid transparent`,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={500} size="sm" truncate="end">{props.session.title}</Text>
          <Text c="dimmed" size="xs">{new Date(props.session.updatedAt).toLocaleString('zh-CN')}</Text>
        </Stack>
        <ActionIcon
          aria-label="删除会话"
          color="red"
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            props.onDelete(props.session.id)
          }}
        >
          ×
        </ActionIcon>
      </Group>
    </Paper>
  )
}
