import { Box, Text } from 'ink'
// import { Logo } from '../components/Logo'
import { Prompt } from '../../components/Prompt/index'
import { Tips } from '../../components/Tips'
import { useTheme } from '../../theme'

export function Home() {
  const theme = useTheme()

  return (
    <Box flexDirection="column" flexGrow={1}>
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
          <Box width={75}>
            <Prompt />
          </Box>
        </Box>

        <Box
          height={4}
          width={75}
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
