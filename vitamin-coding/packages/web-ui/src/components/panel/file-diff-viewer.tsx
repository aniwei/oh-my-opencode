import { Box, Paper, ScrollArea, Text, useMantineTheme } from '@mantine/core'
import type { VitaminColorTokens } from '@vitamin/ui-kit'

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

const LINE_COLORS_LIGHT: Record<DiffLine['type'], { bg: string; color: string }> = {
  add: { bg: 'rgba(23, 178, 106, 0.08)', color: '#079455' },
  remove: { bg: 'rgba(240, 68, 56, 0.08)', color: '#d92d20' },
  context: { bg: 'transparent', color: 'inherit' },
  header: { bg: 'rgba(21, 90, 239, 0.06)', color: '#155aef' },
}

const LINE_COLORS_DARK: Record<DiffLine['type'], { bg: string; color: string }> = {
  add: { bg: 'rgba(23, 178, 106, 0.14)', color: '#47cd89' },
  remove: { bg: 'rgba(240, 68, 56, 0.14)', color: '#f97066' },
  context: { bg: 'transparent', color: 'inherit' },
  header: { bg: 'rgba(21, 90, 239, 0.1)', color: '#84abff' },
}

export function FileDiffViewer(props: FileDiffViewerProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens
  const lines = parseDiffLines(props.diff)
  const lineColors = theme.colorScheme === 'dark' ? LINE_COLORS_DARK : LINE_COLORS_LIGHT

  if (lines.length === 0) {
    return (
      <Paper p="xs" radius="md" withBorder>
        <Text c="dimmed" size="sm">暂无差异</Text>
      </Paper>
    )
  }

  return (
    <Paper radius="md" style={{ overflow: 'hidden', border: `1px solid ${tokens.divider.regular}` }}>
      <Text size="xs" px="xs" py={4} style={{ color: tokens.text.tertiary }}>Unified Diff</Text>
      <ScrollArea.Autosize mah={400}>
        <Box style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '0.8em' }}>
          {lines.map((line, index) => {
            const style = lineColors[line.type]
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
