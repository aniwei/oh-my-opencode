import { useEffect, useCallback } from 'react'
import { Box, Text } from 'ink'
import { useApp } from '../context/app-context'
import { theme } from '../theme'

/**
 * Toast notification — displays at top-right, auto-dismisses.
 * Reads from `useApp().state.toast`.
 */
export function Toast() {
  const { state, dispatch } = useApp()
  const toast = state.toast

  const dismiss = useCallback(() => {
    dispatch({ type: 'toast/dismiss' })
  }, [dispatch])

  useEffect(() => {
    if (toast == null) return
    const duration = toast.duration ?? 3000
    const timer = setTimeout(dismiss, duration)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  if (toast == null) return null

  const colorMap = {
    info: theme.info,
    success: theme.success,
    error: theme.error,
    warning: theme.warning,
  } as const

  const iconMap = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    warning: '△',
  } as const

  return (
    <Box
      position="absolute"
      marginLeft={-1}
      flexDirection="row"
      gap={1}
    >
      <Text color={colorMap[toast.type]}>
        {iconMap[toast.type]}
      </Text>
      <Text color={theme.text}>
        {toast.message}
      </Text>
    </Box>
  )
}
