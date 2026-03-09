import { Box, Text } from 'ink'
import { theme } from '../../../theme'

interface TimelineEntry {
  id: string
  role: 'user' | 'assistant'
  preview: string
  timestamp?: number
}

interface TimelineDialogProps {
  entries: TimelineEntry[]
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * Timeline / message jump dialog — list of messages for quick navigation.
 */
export function TimelineDialog({ entries, onSelect: _onSelect, onClose: _onClose }: TimelineDialogProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.text} bold>
        Timeline
      </Text>
      <Box flexDirection="column" paddingTop={1}>
        {entries.map((entry, i) => (
          <Box key={entry.id} flexDirection="row" gap={1}>
            <Text color={theme.textMuted}>{i + 1}.</Text>
            <Text color={entry.role === 'user' ? theme.secondary : theme.accent}>
              {entry.role}
            </Text>
            <Text color={theme.textMuted} wrap="truncate">
              {entry.preview.slice(0, 60)}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
