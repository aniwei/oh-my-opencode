import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface InlineToolProps {
  name: string
  input?: string
  output?: string
}

export function InlineTool({ name, input, output }: InlineToolProps) {
  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={theme.info}>{name}</Text>
      {input != null && <Text color={theme.textMuted}>{input}</Text>}
      {output != null && <Text color={theme.text}>→ {output}</Text>}
    </Box>
  )
}
