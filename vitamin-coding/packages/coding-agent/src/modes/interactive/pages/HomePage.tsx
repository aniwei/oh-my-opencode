import { Box, Text } from 'ink'
import { Prompt } from '../components/Prompt/index'
import { Tips } from '../components/Tips'
import { useTheme } from '../theme'

/**
 * Home page — centered Logo + Prompt + Tips + bottom status bar.
 *
 * Data-dependent features (MCP status, session count, version) are
 * stubbed with placeholders until the data layer is connected.
 */
export function HomePage() {
  const theme = useTheme()

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Main content area — centered vertically */}
      <Box
        flexGrow={1}
        alignItems="center"
        paddingLeft={2}
        paddingRight={2}
        flexDirection="column"
      >
        <Box flexGrow={1} />

        <Box flexShrink={0}>
          {/* <Logo /> */}
        </Box>

        <Box height={1} />

        <Box width="100%" flexDirection="column" alignItems="center">
          <Box width="75%">
            <Prompt commands={[{
              label: 'Open file',
              value: 'open_file',
              type: 'command',
              description: 'Open a file'
            }, {
              label: 'Close file',
              value: 'close_file',
              type: 'command',
              description: 'Close a file'
            }]} />
          </Box>
        </Box>

        <Box
          height={4}
          width="75%"
          alignItems="center"
          paddingTop={1}
          flexShrink={1}
        >
          <Tips />
        </Box>

        <Box flexGrow={1} />
      </Box>

      {/* Bottom status bar */}
      <Box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        flexDirection="row"
        flexShrink={0}
        gap={2}
      >
        <Text color={theme.textMuted}>.</Text>
        <Box flexGrow={1} />
        <Text color={theme.textMuted}>v0.0.0</Text>
      </Box>
    </Box>
  )
}
