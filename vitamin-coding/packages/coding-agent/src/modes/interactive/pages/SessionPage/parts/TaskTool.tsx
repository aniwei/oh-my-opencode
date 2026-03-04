import { Box, Text } from 'ink'
import { theme } from '../../../theme.js'
import { Spinner } from '../../../components/Spinner.js'

interface TaskToolProps {
  description: string
  status?: 'running' | 'completed' | 'failed'
}

export function TaskTool({ description, status }: TaskToolProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.accent}>Task</Text>
        <Text color={theme.text}>{description}</Text>
      </Box>
      {status === 'running' && <Spinner color={theme.accent}>processing...</Spinner>}
      {status === 'completed' && <Text color={theme.success}>✓ complete</Text>}
      {status === 'failed' && <Text color={theme.error}>✗ failed</Text>}
    </Box>
  )
}
