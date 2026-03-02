import { Box, Paper, ScrollArea, Text } from '@mantine/core'

interface FileDiffViewerProps {
  diff: string
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header'
  content: string
}

function parseDiffLines(diff: string): DiffLine[] {
  if (!diff) {
    return []
  }

  return diff.split('\n').map((line) => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      return { type: 'header', content: line }
    }

    if (line.startsWith('+')) {
      return { type: 'add', content: line }
    }

    if (line.startsWith('-')) {
      return { type: 'remove', content: line }
    }

    return { type: 'context', content: line }
  })
}

const LINE_COLORS: Record<DiffLine['type'], { bg: string; color: string }> = {
  add: { bg: 'rgba(81, 207, 102, 0.1)', color: '#51cf66' },
  remove: { bg: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b' },
  context: { bg: 'transparent', color: 'inherit' },
  header: { bg: 'rgba(91, 167, 252, 0.08)', color: 'var(--mantine-color-blue-4)' },
}

export function FileDiffViewer(props: FileDiffViewerProps) {
  const lines = parseDiffLines(props.diff)

  if (lines.length === 0) {
    return (
      <Paper p="xs" radius="md" withBorder>
        <Text c="dimmed" size="sm">暂无差异</Text>
      </Paper>
    )
  }

  return (
    <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
      <Text c="dimmed" size="xs" px="xs" py={4}>Unified Diff</Text>
      <ScrollArea.Autosize mah={400}>
        <Box style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '0.8em' }}>
          {lines.map((line, index) => {
            const style = LINE_COLORS[line.type]
            return (
              <Box
                key={index}
                px="xs"
                style={{
                  background: style.bg,
                  color: style.color,
                  whiteSpace: 'pre',
                  lineHeight: 1.6,
                  minHeight: 20,
                }}
              >
                {line.content || ' '}
              </Box>
            )
          })}
        </Box>
      </ScrollArea.Autosize>
    </Paper>
  )
}
