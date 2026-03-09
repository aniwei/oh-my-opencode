import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface SubagentEntry {
  sessionID: string
  agent: string
  status: 'running' | 'completed' | 'failed'
}

interface SubagentDialogProps {
  subagents: SubagentEntry[]
  onSelect: (sessionID: string) => void
  onClose: () => void
}

/**
 * Subagent session list dialog.
 */
export function SubagentDialog({ subagents, onSelect: _onSelect, onClose: _onClose }: SubagentDialogProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.text} bold>
        Subagent Sessions
      </Text>
      <Box flexDirection="column" paddingTop={1}>
        {subagents.map((sa) => (
          <Box key={sa.sessionID} flexDirection="row" gap={1}>
            <Text
              color={
                sa.status === 'completed'
                  ? theme.success
                  : sa.status === 'failed'
                    ? theme.error
                    : theme.warning
              }
            >
              {sa.status === 'completed' ? '✓' : sa.status === 'failed' ? '✗' : '●'}
            </Text>
            <Text color={theme.text}>{sa.agent}</Text>
            <Text color={theme.textMuted}>{sa.sessionID.slice(0, 8)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
