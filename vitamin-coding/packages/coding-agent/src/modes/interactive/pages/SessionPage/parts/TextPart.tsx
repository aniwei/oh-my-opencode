import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface TextPartProps {
  content: string
}

export function TextPart({ content }: TextPartProps) {
  return (
    <Box>
      <Text color={theme.text} wrap="wrap">
        {content}
      </Text>
    </Box>
  )
}
