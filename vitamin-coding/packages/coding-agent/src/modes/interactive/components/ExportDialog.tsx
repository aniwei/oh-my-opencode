import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useApp } from '../context/app-context.js'
import { theme } from '../theme.js'

type ExportFormat = 'markdown' | 'json' | 'text'

interface ExportDialogProps {
  sessionID: string
  onExport: (format: ExportFormat) => void
}

const formats: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'markdown', label: 'Markdown', description: 'Full conversation with formatting' },
  { value: 'json', label: 'JSON', description: 'Structured data for programmatic use' },
  { value: 'text', label: 'Plain Text', description: 'Simple text without formatting' },
]

/**
 * Export transcript format selection dialog. Phase 6.
 */
export function ExportDialog({ onExport }: ExportDialogProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const { dispatch } = useApp()

  useInput((_input, key) => {
    if (key.escape) {
      dispatch({ type: 'dialog/pop' })
    }
    if (key.upArrow) {
      setFocusedIndex((prev) => Math.max(0, prev - 1))
    }
    if (key.downArrow) {
      setFocusedIndex((prev) => Math.min(formats.length - 1, prev + 1))
    }
    if (key.return) {
      const format = formats[focusedIndex]
      if (format) {
        onExport(format.value)
        dispatch({ type: 'dialog/pop' })
      }
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>
        Export Transcript
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {formats.map((format, i) => {
          const isFocused = i === focusedIndex
          return (
            <Box key={format.value} flexDirection="row" gap={1}>
              <Text color={isFocused ? theme.primary : theme.textMuted}>
                {isFocused ? '▸' : ' '}
              </Text>
              <Text
                color={isFocused ? theme.text : theme.textMuted}
                bold={isFocused}
              >
                {format.label}
              </Text>
              <Text color={theme.textMuted} dimColor>
                — {format.description}
              </Text>
            </Box>
          )
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.textMuted} dimColor>
          ↑↓ select · Enter export · Esc cancel
        </Text>
      </Box>
    </Box>
  )
}
