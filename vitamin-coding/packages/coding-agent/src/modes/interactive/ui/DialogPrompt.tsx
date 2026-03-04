import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { theme } from '../theme.js'

interface DialogPromptProps {
  title: string
  placeholder?: string
  initialValue?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function DialogPrompt({
  title,
  placeholder,
  initialValue = '',
  onSubmit,
  onCancel,
}: DialogPromptProps) {
  const [value, setValue] = useState(initialValue)

  useInput((_input, key) => {
    if (key.escape) {
      onCancel()
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      width={50}
      padding={1}
    >
      <Text color={theme.text} bold>
        {title}
      </Text>
      <Box
        paddingTop={1}
        borderStyle="round"
        borderColor={theme.border}
        paddingLeft={1}
        paddingRight={1}
      >
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={onSubmit}
          placeholder={placeholder ?? 'Enter value...'}
          focus
          showCursor
        />
      </Box>
      <Box paddingTop={1}>
        <Text color={theme.textMuted}>Enter to submit, Escape to cancel</Text>
      </Box>
    </Box>
  )
}
