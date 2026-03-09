import { Box, Text } from 'ink'
import { theme } from '../../theme'

interface FooterProps {
  directory?: string
  permissionCount?: number
  lspCount?: number
  mcpCount?: number
  mcpError?: boolean
}

/**
 * Session footer — shows directory, LSP/MCP status indicators.
 * Data-dependent fields passed as props.
 */
export function Footer({
  directory = '.',
  permissionCount = 0,
  lspCount = 0,
  mcpCount = 0,
  mcpError = false,
}: FooterProps) {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
      flexShrink={0}
    >
      <Text color={theme.textMuted}>{directory}</Text>
      <Box gap={2} flexDirection="row" flexShrink={0}>
        {permissionCount > 0 && (
          <Text color={theme.warning}>
            △ {permissionCount} Permission{permissionCount > 1 ? 's' : ''}
          </Text>
        )}
        <Text color={theme.text}>
          <Text color={lspCount > 0 ? theme.success : theme.textMuted}>•</Text>{' '}
          {lspCount} LSP
        </Text>
        {mcpCount > 0 && (
          <Text color={theme.text}>
            <Text color={mcpError ? theme.error : theme.success}>⊙ </Text>
            {mcpCount} MCP
          </Text>
        )}
        <Text color={theme.textMuted}>/status</Text>
      </Box>
    </Box>
  )
}
