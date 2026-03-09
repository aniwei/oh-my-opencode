import { DialogSelect, type SelectOption } from '../ui/DialogSelect'

interface ModelEntry {
  id: string
  name: string
  provider: string
  isCurrent?: boolean
}

interface ModelDialogProps {
  models: ModelEntry[]
  onSelect: (modelId: string) => void
  onClose: () => void
}

/**
 * Model selection dialog — fuzzy-searchable list of available models.
 */
export function ModelDialog({ models, onSelect, onClose }: ModelDialogProps) {
  const options: SelectOption[] = models.map((m) => ({
    label: `${m.name}${m.isCurrent ? ' ●' : ''}`,
    value: m.id,
    category: m.provider,
    description: m.id,
  }))

  return (
    <DialogSelect
      title="Select Model"
      options={options}
      onSelect={onSelect}
      onClose={onClose}
      placeholder="Search models..."
    />
  )
}
