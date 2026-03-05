import { Box, Group, Paper, ScrollArea, Text } from '@mantine/core'

interface FilePreviewProps {
  path: string | null
  content: string
}

export function FilePreview(props: FilePreviewProps) {
  if (!props.path) {
    return <Text c="dimmed" size="sm">请选择文件查看预览</Text>
  }

  const lines = (props.content || '空文件').split('\n')
  const gutterWidth = String(lines.length).length * 10 + 16

  return (
    <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
      <Text fw={600} size="sm" px="xs" py={4} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        {props.path}
      </Text>
      <ScrollArea.Autosize mah={300}>
        <Box style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '0.8em' }}>
          {lines.map((line, index) => (
            <Group key={index} gap={0} wrap="nowrap" style={{ lineHeight: 1.6 }}>
              <Text
                c="dimmed"
                size="xs"
                ta="right"
                style={{
                  width: gutterWidth,
                  minWidth: gutterWidth,
                  padding: '0 8px',
                  userSelect: 'none',
                  borderRight: '1px solid var(--mantine-color-default-border)',
                }}
              >
                {index + 1}
              </Text>
              <Box px="xs" style={{ whiteSpace: 'pre', overflow: 'hidden' }}>
                {line || ' '}
              </Box>
            </Group>
          ))}
        </Box>
      </ScrollArea.Autosize>
    </Paper>
  )
}
