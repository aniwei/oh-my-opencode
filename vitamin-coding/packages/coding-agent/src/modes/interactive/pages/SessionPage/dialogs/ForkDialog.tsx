import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface ForkDialogProps {
  sessionID: string
  messageId: string
  onFork: (messageId: string) => void
  onClose: () => void
}

/**
 * Fork session dialog — allows forking from a specific message.
 */
export function ForkDialog({ messageId, onFork: _onFork, onClose: _onClose }: ForkDialogProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.text} bold>
        Fork Session
      </Text>
      <Box paddingTop={1}>
        <Text color={theme.textMuted}>
          Fork from message: {messageId}
        </Text>
      </Box>
      <Box paddingTop={1}>
        <Text color={theme.textMuted}>Press Enter to confirm, Escape to cancel</Text>
      </Box>
    </Box>
  )
}
