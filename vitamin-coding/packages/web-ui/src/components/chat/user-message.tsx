import { Group, Image, Paper, Text } from '@mantine/core'
import type { ChatMessage } from '../../types/message'
import { MarkdownRenderer } from './markdown-renderer'

interface UserMessageProps {
  message: ChatMessage
}

export function UserMessage(props: UserMessageProps) {
  const hasMarkdown = props.message.content.includes('```') ||
    props.message.content.includes('**') ||
    props.message.content.includes('- ') ||
    props.message.content.includes('# ')

  return (
    <Paper p="sm" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
      {hasMarkdown ? (
        <MarkdownRenderer content={props.message.content} />
      ) : (
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{props.message.content}</Text>
      )}
      {props.message.attachments && props.message.attachments.length > 0 ? (
        <Group gap="xs" mt="xs">
          {props.message.attachments.map((attachment, index) => (
            <Paper key={index} p={4} radius="sm" withBorder>
              {attachment.type === 'image' ? (
                <Image
                  src={attachment.url}
                  alt={attachment.name}
                  h={80}
                  w={80}
                  fit="cover"
                  radius="sm"
                />
              ) : (
                <Text size="xs" c="dimmed">{attachment.name}</Text>
              )}
            </Paper>
          ))}
        </Group>
      ) : null}
    </Paper>
  )
}
