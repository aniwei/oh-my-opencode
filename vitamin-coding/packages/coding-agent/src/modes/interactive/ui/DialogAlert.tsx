import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'

interface DialogAlertProps {
  title: string
  message: string
  onClose: () => void
}

export function DialogAlert({ title, message, onClose }: DialogAlertProps) {
  useInput((_input, key) => {
    if (key.return || key.escape) {
      onClose()
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.info}
      width={50}
      padding={1}
    >
      <Text color={theme.text} bold>
        {title}
      </Text>
      <Box paddingTop={1} paddingBottom={1}>
        <Text color={theme.textMuted} wrap="wrap">
          {message}
        </Text>
      </Box>
      <Text color={theme.textMuted}>Press Enter or Escape to close</Text>
    </Box>
  )
}
