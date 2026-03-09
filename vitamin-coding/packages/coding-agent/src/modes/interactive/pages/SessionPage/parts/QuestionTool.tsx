import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface QuestionToolProps {
  question: string
  answer?: string
}

export function QuestionTool({ question, answer }: QuestionToolProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.warning}>?</Text>
        <Text color={theme.text}>{question}</Text>
      </Box>
      {answer != null && (
        <Box paddingLeft={2}>
          <Text color={theme.textMuted}>→ {answer}</Text>
        </Box>
      )}
    </Box>
  )
}
