import { DialogSelect, type SelectOption } from '../ui/DialogSelect'

interface SessionEntry {
  id: string
  title: string
  updatedAt?: string
  messageCount?: number
}

interface SessionListDialogProps {
  sessions: SessionEntry[]
  onSelect: (sessionId: string) => void
  onClose: () => void
}

export function SessionListDialog({
  sessions,
  onSelect,
  onClose,
}: SessionListDialogProps) {
  const options: SelectOption[] = sessions.map((s) => ({
    label: s.title,
    value: s.id,
    description: s.updatedAt != null
      ? `${s.updatedAt}${s.messageCount != null ? ` · ${s.messageCount} msgs` : ''}`
      : undefined,
  }))

  return (
    <DialogSelect
      title="Sessions"
      options={options}
      onSelect={onSelect}
      onClose={onClose}
      placeholder="Search sessions..."
    />
  )
}
