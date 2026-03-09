import { Box, Text } from 'ink'
import { theme } from '../../../theme'
import { Spinner } from '../../../components/Spinner'

interface BashToolProps {
  command: string
  output?: string
  exitCode?: number
  isRunning?: boolean
}

export function BashTool({ command, output, exitCode, isRunning }: BashToolProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.warning}>$</Text>
        <Text color={theme.text} bold>
          {command}
        </Text>
        {exitCode != null && exitCode !== 0 && (
          <Text color={theme.error}>(exit {exitCode})</Text>
        )}
      </Box>
      {isRunning && <Spinner color={theme.warning}>running...</Spinner>}
      {output != null && output.length > 0 && (
        <Box paddingLeft={2}>
          <Text color={theme.textMuted} wrap="wrap">
            {output.length > 500 ? `${output.slice(0, 500)}…` : output}
          </Text>
        </Box>
      )}
    </Box>
  )
}
