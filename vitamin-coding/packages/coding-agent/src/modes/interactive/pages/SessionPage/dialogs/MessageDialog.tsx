import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface MessageDialogProps {
  messageId: string
  content: string
  role: 'user' | 'assistant'
  onClose: () => void
}

/**
 * Full-screen message detail viewer.
 */
export function MessageDialog({ content, role, onClose: _onClose }: MessageDialogProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.text} bold>
        {role === 'user' ? 'User Message' : 'Assistant Message'}
      </Text>
      <Box paddingTop={1}>
        <Text color={theme.text} wrap="wrap">
          {content}
        </Text>
      </Box>
    </Box>
  )
}
