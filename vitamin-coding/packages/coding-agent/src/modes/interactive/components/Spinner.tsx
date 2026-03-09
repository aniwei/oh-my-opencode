import { Box, Text } from 'ink'
import InkSpinner from 'ink-spinner'
import type { ReactNode } from 'react'
import { theme } from '../theme'

interface SpinnerProps {
  children?: ReactNode
  color?: string
}

export function Spinner({ children, color }: SpinnerProps) {
  const fg = color ?? theme.textMuted

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={fg}>
        <InkSpinner type="dots" />
      </Text>
      {children != null && <Text color={fg}>{children}</Text>}
    </Box>
  )
}
