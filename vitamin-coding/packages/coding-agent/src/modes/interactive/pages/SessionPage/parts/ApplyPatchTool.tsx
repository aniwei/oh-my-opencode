import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface ApplyPatchToolProps {
  filePath: string
  hunks?: number
}

export function ApplyPatchTool({ filePath, hunks }: ApplyPatchToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={theme.warning}>Patch</Text>
      <Text color={theme.text}>{filePath}</Text>
      {hunks != null && (
        <Text color={theme.textMuted}>({hunks} hunk{hunks !== 1 ? 's' : ''})</Text>
      )}
    </Box>
  )
}
