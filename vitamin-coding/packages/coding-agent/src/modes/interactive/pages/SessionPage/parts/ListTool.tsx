import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface ListToolProps {
  directory: string
  fileCount?: number
}

export function ListTool({ directory, fileCount }: ListToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={theme.info}>List</Text>
      <Text color={theme.text}>{directory}</Text>
      {fileCount != null && (
        <Text color={theme.textMuted}>({fileCount} entries)</Text>
      )}
    </Box>
  )
}
