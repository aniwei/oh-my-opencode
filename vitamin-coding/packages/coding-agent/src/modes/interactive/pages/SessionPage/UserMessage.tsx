import { Box, Text } from 'ink'
import { theme } from '../../theme'

export interface UserMessageData {
  id: string
  content: string
  timestamp?: number
}

interface UserMessageProps {
  message: UserMessageData
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.secondary} bold>
          You
        </Text>
        {message.timestamp != null && (
          <Text color={theme.textMuted}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </Text>
        )}
      </Box>
      <Box paddingTop={0}>
        <Text color={theme.text} wrap="wrap">
          {message.content}
        </Text>
      </Box>
    </Box>
  )
}
