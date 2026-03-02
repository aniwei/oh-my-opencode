import { Stack } from '@mantine/core'
import type { ChatMessage } from '../../types/message'
import { MarkdownRenderer } from './markdown-renderer'
import { ThinkingBlock } from './thinking-block'
import { ToolCallCard } from './tool-call-card'

interface AssistantMessageProps {
  message: ChatMessage
}

export function AssistantMessage(props: AssistantMessageProps) {
  return (
    <Stack gap="xs">
      {props.message.thinking ? <ThinkingBlock content={props.message.thinking} /> : null}
      <MarkdownRenderer content={props.message.content} />
      {props.message.toolCalls?.map((tool) => (
        <ToolCallCard key={tool.id} tool={tool} />
      ))}
    </Stack>
  )
}
