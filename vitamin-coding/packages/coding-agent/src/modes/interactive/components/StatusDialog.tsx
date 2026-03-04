import { Box, Text } from 'ink'
import { theme } from '../theme.js'

interface StatusInfo {
  version: string
  model?: string
  agent?: string
  sessionCount?: number
  directory?: string
  lspServers?: string[]
  mcpServers?: Array<{ name: string; status: string }>
}

interface StatusDialogProps {
  status: StatusInfo
  onClose: () => void
}

export function StatusDialog({ status, onClose: _onClose }: StatusDialogProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      width={60}
      padding={1}
    >
      <Text color={theme.text} bold>
        System Status
      </Text>
      <Box flexDirection="column" paddingTop={1} gap={0}>
        <Text color={theme.textMuted}>
          Version: <Text color={theme.text}>{status.version}</Text>
        </Text>
        {status.model != null && (
          <Text color={theme.textMuted}>
            Model: <Text color={theme.text}>{status.model}</Text>
          </Text>
        )}
        {status.agent != null && (
          <Text color={theme.textMuted}>
            Agent: <Text color={theme.text}>{status.agent}</Text>
          </Text>
        )}
        {status.sessionCount != null && (
          <Text color={theme.textMuted}>
            Sessions: <Text color={theme.text}>{status.sessionCount}</Text>
          </Text>
        )}
        {status.directory != null && (
          <Text color={theme.textMuted}>
            Directory: <Text color={theme.text}>{status.directory}</Text>
          </Text>
        )}
        {(status.lspServers?.length ?? 0) > 0 && (
          <Text color={theme.textMuted}>
            LSP: <Text color={theme.text}>{status.lspServers!.join(', ')}</Text>
          </Text>
        )}
      </Box>
      <Box paddingTop={1}>
        <Text color={theme.textMuted}>Press Escape to close</Text>
      </Box>
    </Box>
  )
}
