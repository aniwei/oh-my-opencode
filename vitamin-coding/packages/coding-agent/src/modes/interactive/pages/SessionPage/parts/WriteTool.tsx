import { Box, Text } from 'ink'
import { theme } from '../../../theme.js'

interface WriteToolProps {
  filePath: string
  lineCount?: number
  isNew?: boolean
}

export function WriteTool({ filePath, lineCount, isNew }: WriteToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={isNew ? theme.diffAdded : theme.warning}>
        {isNew ? 'Create' : 'Write'}
      </Text>
      <Text color={theme.text}>{filePath}</Text>
      {lineCount != null && (
        <Text color={theme.textMuted}>({lineCount} lines)</Text>
      )}
    </Box>
  )
}
