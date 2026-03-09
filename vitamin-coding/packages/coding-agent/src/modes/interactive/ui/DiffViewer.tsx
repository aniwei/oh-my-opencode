import { Box, Text } from 'ink'
import { theme } from '../theme'
import { createDiffLines, type DiffLine } from '../shared/diff-utils'

interface DiffViewerProps {
  oldText: string
  newText: string
  filePath?: string
}

/**
 * Thin diff viewer wrapper — uses `diff` library output + chalk-style coloring.
 */
export function DiffViewer({ oldText, newText, filePath }: DiffViewerProps) {
  const lines = createDiffLines(oldText, newText)

  return (
    <Box flexDirection="column">
      {filePath != null && (
        <Text color={theme.textMuted} bold>
          {filePath}
        </Text>
      )}
      {lines.map((line, i) => (
        <DiffLineView key={i} line={line} />
      ))}
    </Box>
  )
}

function DiffLineView({ line }: { line: DiffLine }) {
  const colorMap = {
    added: theme.diffAdded,
    removed: theme.diffRemoved,
    context: theme.diffContext,
    header: theme.diffHunkHeader,
  } as const

  const bgMap = {
    added: theme.diffAddedBg,
    removed: theme.diffRemovedBg,
    context: theme.diffContextBg,
    header: undefined,
  } as const

  return (
    <Box>
      <Text
        color={colorMap[line.type]}
        backgroundColor={bgMap[line.type]}
      >
        {line.prefix}{line.content}
      </Text>
    </Box>
  )
}
