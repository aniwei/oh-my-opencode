import { Box, Text } from 'ink'
import { theme } from '../../../theme.js'

interface ReadToolProps {
  filePath: string
  lineCount?: number
}

export function ReadTool({ filePath, lineCount }: ReadToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={theme.info}>Read</Text>
      <Text color={theme.text}>{filePath}</Text>
      {lineCount != null && (
        <Text color={theme.textMuted}>({lineCount} lines)</Text>
      )}
    </Box>
  )
}
