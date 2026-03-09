import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface ReasoningPartProps {
  content: string
}

export function ReasoningPart({ content }: ReasoningPartProps) {
  return (
    <Box paddingLeft={1} borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} borderColor={theme.borderSubtle}>
      <Text color={theme.textMuted} italic wrap="wrap">
        {content}
      </Text>
    </Box>
  )
}
