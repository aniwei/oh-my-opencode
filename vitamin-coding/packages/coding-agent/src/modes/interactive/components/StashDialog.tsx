import { Box, Text, useInput } from 'ink'
import { useApp } from '../context/app-context.js'
import { theme } from '../theme.js'

interface StashDialogProps {
  items: string[]
  onRestore: (index: number) => void
  onClear: () => void
}

/**
 * Dialog displaying stashed prompts. Phase 6.
 */
export function StashDialog({ items, onRestore, onClear }: StashDialogProps) {
  const { dispatch } = useApp()

  useInput((input, key) => {
    if (key.escape) {
      dispatch({ type: 'dialog/pop' })
    }
    if (input === 'c') {
      onClear()
      dispatch({ type: 'dialog/pop' })
    }
    const num = parseInt(input, 10)
    if (!isNaN(num) && num >= 1 && num <= items.length) {
      onRestore(num - 1)
      dispatch({ type: 'dialog/pop' })
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>
        Stashed Prompts ({items.length})
      </Text>
      {items.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>No stashed prompts</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {items.map((item, i) => (
            <Box key={i} flexDirection="row" gap={1}>
              <Text color={theme.accent} bold>
                {i + 1}.
              </Text>
              <Text color={theme.text}>
                {item.length > 60 ? item.slice(0, 57) + '...' : item}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.textMuted} dimColor>
          1-{items.length} to restore · c to clear all · Esc to close
        </Text>
      </Box>
    </Box>
  )
}
