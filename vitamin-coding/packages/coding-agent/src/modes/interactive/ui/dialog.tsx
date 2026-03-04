import { useCallback, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { useApp } from '../context/app-context.js'
import { theme } from '../theme.js'

interface DialogProps {
  title?: string
  children: ReactNode
  onClose?: () => void
  width?: number
}

/**
 * Modal dialog container — rendered on top of the dialog stack.
 * Escape closes the top dialog. Consumes `useApp().state.dialog.stack`.
 */
export function Dialog({ title, children, onClose, width }: DialogProps) {
  const { dispatch } = useApp()

  const handleClose = useCallback(() => {
    onClose?.()
    dispatch({ type: 'dialog/pop' })
  }, [onClose, dispatch])

  useInput((_input, key) => {
    if (key.escape) {
      handleClose()
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      width={width ?? 60}
      padding={1}
    >
      {title != null && (
        <Box paddingBottom={1}>
          <Text color={theme.text} bold>
            {title}
          </Text>
          <Box flexGrow={1} />
          <Text color={theme.textMuted}>ESC</Text>
        </Box>
      )}
      {children}
    </Box>
  )
}

/**
 * Dialog overlay — renders the top dialog from the stack.
 * Place this in the root layout to show modals.
 */
export function DialogOverlay() {
  const { state } = useApp()
  const { stack } = state.dialog

  if (stack.length === 0) return null

  const top = stack[stack.length - 1]!
  return (
    <Box
      position="absolute"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      {top.element}
    </Box>
  )
}
