import { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useApp } from '../context/app-context.js'
import { theme } from '../theme.js'

interface SessionRenameDialogProps {
  sessionID: string
  currentName: string
  onRename: (name: string) => void
}

/**
 * Dialog for renaming a session. Phase 6.
 */
export function SessionRenameDialog({
  currentName,
  onRename,
}: SessionRenameDialogProps) {
  const [value, setValue] = useState(currentName)
  const { dispatch } = useApp()

  const handleSubmit = useCallback(
    (input: string) => {
      const trimmed = input.trim()
      if (trimmed.length > 0) {
        onRename(trimmed)
      }
      dispatch({ type: 'dialog/pop' })
    },
    [onRename, dispatch],
  )

  useInput((_input, key) => {
    if (key.escape) {
      dispatch({ type: 'dialog/pop' })
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>
        Rename Session
      </Text>
      <Box marginTop={1}>
        <Text color={theme.textMuted}>New name: </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          focus
          showCursor
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.textMuted} dimColor>
          Enter to confirm · Esc to cancel
        </Text>
      </Box>
    </Box>
  )
}
