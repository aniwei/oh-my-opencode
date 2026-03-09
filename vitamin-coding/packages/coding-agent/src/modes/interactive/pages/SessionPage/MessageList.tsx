import { Box, Text } from 'ink'
import { UserMessage, type UserMessageData } from './UserMessage'
import { AssistantMessage, type AssistantMessageData } from './AssistantMessage'
import { theme } from '../../theme'

export type MessageData =
  | { role: 'user'; data: UserMessageData }
  | { role: 'assistant'; data: AssistantMessageData }

interface MessageListProps {
  messages: MessageData[]
}

/**
 * Scrollable message list.
 * Currently renders as a simple vertical list.
 * ink-scroll-view integration will be added when the data layer provides
 * real message streams with dynamic updates.
 */
export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text color={theme.textMuted}>No messages yet</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return <UserMessage key={msg.data.id} message={msg.data} />
        }
        return <AssistantMessage key={msg.data.id} message={msg.data} />
      })}
    </Box>
  )
}
