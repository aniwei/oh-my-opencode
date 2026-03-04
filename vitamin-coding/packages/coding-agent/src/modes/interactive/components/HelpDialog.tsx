import { Box, Text } from 'ink'
import { theme } from '../theme.js'

interface HelpEntry {
  keybind: string
  description: string
  category: string
}

const HELP_ENTRIES: HelpEntry[] = [
  { keybind: 'Ctrl+P', description: 'Command palette', category: 'General' },
  { keybind: 'Ctrl+X N', description: 'New session', category: 'Session' },
  { keybind: 'Ctrl+X L', description: 'Session list', category: 'Session' },
  { keybind: 'Ctrl+X M', description: 'Model select', category: 'Config' },
  { keybind: 'Ctrl+X A', description: 'Agent select', category: 'Config' },
  { keybind: 'Ctrl+X B', description: 'Toggle sidebar', category: 'UI' },
  { keybind: 'Ctrl+X E', description: 'External editor', category: 'Input' },
  { keybind: 'Ctrl+X G', description: 'Timeline', category: 'Navigation' },
  { keybind: 'Ctrl+X H', description: 'Help', category: 'General' },
  { keybind: 'Ctrl+X S', description: 'Status', category: 'System' },
  { keybind: 'Ctrl+X X', description: 'Export', category: 'Share' },
  { keybind: 'Ctrl+X Y', description: 'Copy last response', category: 'Share' },
  { keybind: 'F2', description: 'Quick model switch', category: 'Config' },
  { keybind: 'Tab', description: 'Cycle agent', category: 'Input' },
  { keybind: 'Shift+Enter', description: 'Newline', category: 'Input' },
  { keybind: 'Escape', description: 'Cancel / stop', category: 'General' },
  { keybind: 'PageUp/Down', description: 'Scroll', category: 'Navigation' },
  { keybind: 'Home', description: 'Jump to top', category: 'Navigation' },
  { keybind: 'End', description: 'Jump to bottom', category: 'Navigation' },
]

interface HelpDialogProps {
  onClose: () => void
}

export function HelpDialog({ onClose: _onClose }: HelpDialogProps) {
  const categories = [...new Set(HELP_ENTRIES.map((e) => e.category))]

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      width={60}
      padding={1}
    >
      <Text color={theme.text} bold>
        Keyboard Shortcuts
      </Text>
      {categories.map((cat) => (
        <Box key={cat} flexDirection="column" paddingTop={1}>
          <Text color={theme.accent} bold>
            {cat}
          </Text>
          {HELP_ENTRIES.filter((e) => e.category === cat).map((entry) => (
            <Box key={entry.keybind} flexDirection="row" gap={1}>
              <Box width={20}>
                <Text color={theme.primary}>{entry.keybind}</Text>
              </Box>
              <Text color={theme.textMuted}>{entry.description}</Text>
            </Box>
          ))}
        </Box>
      ))}
      <Box paddingTop={1}>
        <Text color={theme.textMuted}>Press Escape to close</Text>
      </Box>
    </Box>
  )
}
