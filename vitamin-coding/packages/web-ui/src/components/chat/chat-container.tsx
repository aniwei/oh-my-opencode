import { Stack } from '@mantine/core'
import { useChat } from '../../hooks/use-chat'
import { ChatInput } from '../input/chat-input'
import { MessageList } from './message-list'

interface ChatContainerProps {
  sessionId: string
}

export function ChatContainer(props: ChatContainerProps) {
  const { messages, streaming, sendMessage } = useChat(props.sessionId)

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      <MessageList messages={messages} />
      <ChatInput
        sessionId={props.sessionId}
        sending={streaming}
        onSend={sendMessage}
      />
    </Stack>
  )
}
