import { Paper } from '@mantine/core'
import type { ChatMessage } from '../../types/message'
import { AssistantMessage } from './assistant-message'
import { UserMessage } from './user-message'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble(props: MessageBubbleProps) {
  if (props.message.role === 'assistant') {
    return <AssistantMessage message={props.message} />
  }

  if (props.message.role === 'user') {
    return <UserMessage message={props.message} />
  }

  return (
    <Paper p="xs" radius="sm" withBorder>
      {props.message.content}
    </Paper>
  )
}
