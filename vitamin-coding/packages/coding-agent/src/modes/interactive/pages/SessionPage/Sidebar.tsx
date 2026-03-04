import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { TodoItem } from '../../components/TodoItem.js'
import { theme } from '../../theme.js'

interface McpServer {
  name: string
  status: 'connected' | 'connecting' | 'failed' | 'needs_auth'
}

interface DiffEntry {
  file: string
  additions: number
  deletions: number
}

interface TodoEntry {
  status: string
  content: string
}

interface SidebarProps {
  sessionID: string
  overlay?: boolean
  mcpServers?: McpServer[]
  diffs?: DiffEntry[]
  todos?: TodoEntry[]
  lspServers?: string[]
  cost?: string
  context?: string
}

/**
 * Session sidebar — collapsible sections for MCP, diff, todo, LSP.
 * Fixed width 42 chars. Data passed as props.
 */
export function Sidebar({
  overlay = false,
  mcpServers = [],
  diffs = [],
  todos = [],
  lspServers = [],
  cost,
}: SidebarProps) {
  const [expanded, setExpanded] = useState({
    mcp: true,
    diff: true,
    todo: true,
    lsp: true,
  })

  const toggle = (section: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  useInput((input) => {
    if (input === '1') toggle('mcp')
    else if (input === '2') toggle('diff')
    else if (input === '3') toggle('todo')
    else if (input === '4') toggle('lsp')
  })

  return (
    <Box
      width={42}
      height="100%"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      flexDirection="column"
      position={overlay ? 'absolute' : 'relative'}
    >
      <Box flexDirection="column" flexGrow={1} gap={1}>
        {/* Session info */}
        {cost != null && (
          <Box flexDirection="column">
            <Text color={theme.textMuted}>Cost: {cost}</Text>
          </Box>
        )}

        {/* MCP section */}
        {mcpServers.length > 0 && (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Text
                color={theme.text}
                bold
              >
                {expanded.mcp ? '▼' : '▸'} MCP ({mcpServers.length})
              </Text>
            </Box>
            {expanded.mcp &&
              mcpServers.map((server) => (
                <Box key={server.name} paddingLeft={2} flexDirection="row">
                  <Text
                    color={
                      server.status === 'connected'
                        ? theme.success
                        : server.status === 'failed'
                          ? theme.error
                          : theme.warning
                    }
                  >
                    {server.status === 'connected' ? '●' : server.status === 'failed' ? '✗' : '○'}{' '}
                  </Text>
                  <Text color={theme.textMuted}>{server.name}</Text>
                </Box>
              ))}
          </Box>
        )}

        {/* Diff section */}
        {diffs.length > 0 && (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Text
                color={theme.text}
                bold
              >
                {expanded.diff ? '▼' : '▸'} Changes ({diffs.length})
              </Text>
            </Box>
            {expanded.diff &&
              diffs.map((d) => (
                <Box key={d.file} paddingLeft={2} flexDirection="row" gap={1}>
                  <Text color={theme.textMuted}>{d.file}</Text>
                  {d.additions > 0 && (
                    <Text color={theme.diffAdded}>+{d.additions}</Text>
                  )}
                  {d.deletions > 0 && (
                    <Text color={theme.diffRemoved}>-{d.deletions}</Text>
                  )}
                </Box>
              ))}
          </Box>
        )}

        {/* Todo section */}
        {todos.length > 0 && (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Text
                color={theme.text}
                bold
              >
                {expanded.todo ? '▼' : '▸'} Todo ({todos.length})
              </Text>
            </Box>
            {expanded.todo &&
              todos.map((t, i) => (
                <Box key={i} paddingLeft={2}>
                  <TodoItem status={t.status} content={t.content} />
                </Box>
              ))}
          </Box>
        )}

        {/* LSP section */}
        {lspServers.length > 0 && (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Text
                color={theme.text}
                bold
              >
                {expanded.lsp ? '▼' : '▸'} LSP ({lspServers.length})
              </Text>
            </Box>
            {expanded.lsp &&
              lspServers.map((name) => (
                <Box key={name} paddingLeft={2}>
                  <Text color={theme.success}>● </Text>
                  <Text color={theme.textMuted}>{name}</Text>
                </Box>
              ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
