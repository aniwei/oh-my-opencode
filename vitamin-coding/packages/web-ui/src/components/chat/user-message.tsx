import { Group, Image, Paper, Text, useMantineTheme } from '@mantine/core'
import type { VitaminColorTokens } from '@vitamin/ui-kit'
import type { ChatMessage } from '../../types/message'
import { MarkdownRenderer } from './markdown-renderer'

interface UserMessageProps {
  message: ChatMessage
}

export function UserMessage(props: UserMessageProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const hasMarkdown = props.message.content.includes('```') ||
    props.message.content.includes('**') ||
    props.message.content.includes('- ') ||
    props.message.content.includes('# ')

  return (
    <Paper p="sm" radius="md" shadow="xs" style={{ background: tokens.card.bg, border: `1px solid ${tokens.divider.regular}` }}>
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
