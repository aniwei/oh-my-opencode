import { useCallback } from 'react'
import { useApp } from '../context/app-context.js'
import { DialogSelect, type SelectOption } from '../ui/DialogSelect.js'

/**
 * Default command entries — will be extended when data layer is connected.
 */
const DEFAULT_COMMANDS: SelectOption[] = [
  { label: 'New Session', value: 'session.new', keybind: 'ctrl+x n', category: 'Session' },
  { label: 'Sessions', value: 'session.list', keybind: 'ctrl+x l', category: 'Session' },
  { label: 'Compact', value: 'session.compact', category: 'Session' },
  { label: 'Undo', value: 'session.undo', category: 'Session' },
  { label: 'Redo', value: 'session.redo', category: 'Session' },
  { label: 'Fork', value: 'session.fork', category: 'Session' },
  { label: 'Share', value: 'session.share', category: 'Share' },
  { label: 'Unshare', value: 'session.unshare', category: 'Share' },
  { label: 'Export', value: 'session.export', keybind: 'ctrl+x x', category: 'Share' },
  { label: 'Models', value: 'model.select', keybind: 'ctrl+x m', category: 'Config' },
  { label: 'Agents', value: 'agent.select', keybind: 'ctrl+x a', category: 'Config' },
  { label: 'Providers', value: 'provider.select', category: 'Config' },
  { label: 'Connect', value: 'provider.connect', category: 'Config' },
  { label: 'MCP', value: 'mcp.status', category: 'Config' },
  { label: 'Status', value: 'status.show', keybind: 'ctrl+x s', category: 'System' },
  { label: 'Help', value: 'help.show', keybind: 'ctrl+x h', category: 'System' },
  { label: 'Toggle Sidebar', value: 'sidebar.toggle', keybind: 'ctrl+x b', category: 'UI' },
  { label: 'Timeline', value: 'timeline.show', keybind: 'ctrl+x g', category: 'Session' },
  { label: 'Editor', value: 'editor.open', keybind: 'ctrl+x e', category: 'Input' },
  { label: 'Init', value: 'init', category: 'System' },
  { label: 'Rename', value: 'session.rename', category: 'Session' },
]

interface CommandDialogProps {
  extraCommands?: SelectOption[]
  onSelect: (value: string) => void
  onClose: () => void
}

export function CommandDialog({
  extraCommands = [],
  onSelect,
  onClose,
}: CommandDialogProps) {
  const { dispatch } = useApp()

  const handleSelect = useCallback((value: string) => {
    onSelect(value)
    dispatch({ type: 'dialog/pop' })
  }, [onSelect, dispatch])

  const allCommands = [...DEFAULT_COMMANDS, ...extraCommands]

  return (
    <DialogSelect
      title="Command Palette"
      options={allCommands}
      onSelect={handleSelect}
      onClose={onClose}
      placeholder="Type a command..."
    />
  )
}
