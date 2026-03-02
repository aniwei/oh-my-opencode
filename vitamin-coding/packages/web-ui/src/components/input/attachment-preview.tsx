import { ActionIcon, Group, Image, Paper, ScrollArea, Text } from '@mantine/core'
import type { Attachment } from '../../types/message'

interface AttachmentPreviewProps {
  attachments: Attachment[]
  onRemove: (index: number) => void
}

export function AttachmentPreview(props: AttachmentPreviewProps) {
  if (props.attachments.length === 0) {
    return null
  }

  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Group gap="xs" wrap="nowrap">
        {props.attachments.map((attachment, index) => (
          <Paper key={index} p={4} radius="sm" withBorder style={{ position: 'relative' }}>
            {attachment.type === 'image' ? (
              <Image
                src={attachment.url}
                alt={attachment.name}
                h={60}
                w={60}
                fit="cover"
                radius="sm"
              />
            ) : (
              <Group gap={4} px="xs">
                <Text size="xs">📄</Text>
                <Text size="xs" maw={100} truncate="end">{attachment.name}</Text>
              </Group>
            )}
            <ActionIcon
              aria-label="移除附件"
              color="red"
              size="xs"
              variant="filled"
              radius="xl"
              style={{ position: 'absolute', top: -4, right: -4 }}
              onClick={() => props.onRemove(index)}
            >
              ×
            </ActionIcon>
          </Paper>
        ))}
      </Group>
    </ScrollArea>
  )
}
