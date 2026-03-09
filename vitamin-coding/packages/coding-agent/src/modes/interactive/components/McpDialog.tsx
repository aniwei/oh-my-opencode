import { Box, Text } from 'ink'
import { theme } from '../theme'

interface McpServerInfo {
  name: string
  status: 'connected' | 'connecting' | 'failed' | 'needs_auth'
  toolCount?: number
  error?: string
}

interface McpDialogProps {
  servers: McpServerInfo[]
  onClose: () => void
}

export function McpDialog({ servers, onClose: _onClose }: McpDialogProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      width={60}
      padding={1}
    >
      <Text color={theme.text} bold>
        MCP Servers
      </Text>
      <Box flexDirection="column" paddingTop={1}>
        {servers.length === 0 ? (
          <Text color={theme.textMuted}>No MCP servers configured</Text>
        ) : (
          servers.map((server) => (
            <Box key={server.name} flexDirection="row" gap={1} paddingTop={0}>
              <Text
                color={
                  server.status === 'connected'
                    ? theme.success
                    : server.status === 'failed'
                      ? theme.error
                      : theme.warning
                }
              >
                {server.status === 'connected' ? '●' : server.status === 'failed' ? '✗' : '○'}
              </Text>
              <Text color={theme.text}>{server.name}</Text>
              <Text color={theme.textMuted}>
                [{server.status}]
                {server.toolCount != null && ` ${server.toolCount} tools`}
              </Text>
              {server.error != null && (
                <Text color={theme.error}>{server.error}</Text>
              )}
            </Box>
          ))
        )}
      </Box>
      <Box paddingTop={1}>
        <Text color={theme.textMuted}>Press Escape to close</Text>
      </Box>
    </Box>
  )
}
