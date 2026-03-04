import { Box, Text } from 'ink'
import { theme } from '../../../theme.js'

interface GrepToolProps {
  pattern: string
  matchCount?: number
  fileCount?: number
}

export function GrepTool({ pattern, matchCount, fileCount }: GrepToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={theme.info}>Grep</Text>
      <Text color={theme.text}>{pattern}</Text>
      {matchCount != null && (
        <Text color={theme.textMuted}>
          ({matchCount} match{matchCount !== 1 ? 'es' : ''}
          {fileCount != null && ` in ${fileCount} file${fileCount !== 1 ? 's' : ''}`})
        </Text>
      )}
    </Box>
  )
}
