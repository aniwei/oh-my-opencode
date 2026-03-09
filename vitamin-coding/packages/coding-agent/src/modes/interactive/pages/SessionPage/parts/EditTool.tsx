import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface EditToolProps {
  filePath: string
  additions?: number
  deletions?: number
}

export function EditTool({ filePath, additions, deletions }: EditToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={theme.warning}>Edit</Text>
      <Text color={theme.text}>{filePath}</Text>
      {(additions != null || deletions != null) && (
        <Text color={theme.textMuted}>
          ({additions != null && <Text color={theme.diffAdded}>+{additions}</Text>}
          {additions != null && deletions != null && ' '}
          {deletions != null && <Text color={theme.diffRemoved}>-{deletions}</Text>})
        </Text>
      )}
    </Box>
  )
}
