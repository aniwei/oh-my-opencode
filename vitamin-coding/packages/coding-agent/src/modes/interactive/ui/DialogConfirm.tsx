import { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from '../theme'

interface DialogConfirmProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DialogConfirm({
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}: DialogConfirmProps) {
  const [focused, setFocused] = useState<'confirm' | 'cancel'>('confirm')

  const handleAction = useCallback(() => {
    if (focused === 'confirm') {
      onConfirm()
    } else {
      onCancel()
    }
  }, [focused, onConfirm, onCancel])

  useInput((input, key) => {
    if (key.escape) {
      onCancel()
    } else if (input === 'y') {
      onConfirm()
    } else if (input === 'n') {
      onCancel()
    } else if (key.leftArrow || key.rightArrow || key.tab) {
      setFocused((prev) => (prev === 'confirm' ? 'cancel' : 'confirm'))
    } else if (key.return) {
      handleAction()
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warning}
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
      <Box flexDirection="row" gap={3}>
        <Text
          color={focused === 'confirm' ? theme.success : theme.textMuted}
          bold={focused === 'confirm'}
        >
          [{confirmLabel}]
        </Text>
        <Text
          color={focused === 'cancel' ? theme.error : theme.textMuted}
          bold={focused === 'cancel'}
        >
          [{cancelLabel}]
        </Text>
      </Box>
    </Box>
  )
}
