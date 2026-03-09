import { DialogSelect, type SelectOption } from '../ui/DialogSelect'

interface AgentEntry {
  id: string
  name: string
  description?: string
  isCurrent?: boolean
}

interface AgentDialogProps {
  agents: AgentEntry[]
  onSelect: (agentId: string) => void
  onClose: () => void
}

export function AgentDialog({ agents, onSelect, onClose }: AgentDialogProps) {
  const options: SelectOption[] = agents.map((a) => ({
    label: `${a.name}${a.isCurrent ? ' ●' : ''}`,
    value: a.id,
    description: a.description,
  }))

  return (
    <DialogSelect
      title="Select Agent"
      options={options}
      onSelect={onSelect}
      onClose={onClose}
      placeholder="Search agents..."
    />
  )
}
