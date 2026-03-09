import { Box, Text } from 'ink'
import { theme } from '../theme'

export interface TodoItemProps {
  status: string
  content: string
}

export function TodoItem({ status, content }: TodoItemProps) {
  const icon = status === 'completed' ? '✓' : status === 'in_progress' ? '•' : ' '
  const fg = status === 'in_progress' ? theme.warning : theme.textMuted

  return (
    <Box flexDirection="row">
      <Text color={fg} wrap="truncate">
        [{icon}]{' '}
      </Text>
      <Text color={fg} wrap="wrap">
        {content}
      </Text>
    </Box>
  )
}
