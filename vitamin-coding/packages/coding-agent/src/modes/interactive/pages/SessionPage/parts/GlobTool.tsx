import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface GlobToolProps {
  pattern: string
  matchCount?: number
}

export function GlobTool({ pattern, matchCount }: GlobToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={theme.info}>Glob</Text>
      <Text color={theme.text}>{pattern}</Text>
      {matchCount != null && (
        <Text color={theme.textMuted}>
          ({matchCount} match{matchCount !== 1 ? 'es' : ''})
        </Text>
      )}
    </Box>
  )
}
