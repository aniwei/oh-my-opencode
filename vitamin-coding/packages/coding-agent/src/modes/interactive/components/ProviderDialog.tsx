import { DialogSelect, type SelectOption } from '../ui/DialogSelect'

interface ProviderEntry {
  id: string
  name: string
  connected: boolean
  modelCount: number
}

interface ProviderDialogProps {
  providers: ProviderEntry[]
  onSelect: (providerId: string) => void
  onClose: () => void
}

export function ProviderDialog({
  providers,
  onSelect,
  onClose,
}: ProviderDialogProps) {
  const options: SelectOption[] = providers.map((p) => ({
    label: `${p.name}${p.connected ? '' : ' (disconnected)'}`,
    value: p.id,
    description: `${p.modelCount} model${p.modelCount !== 1 ? 's' : ''}`,
  }))

  return (
    <DialogSelect
      title="Providers"
      options={options}
      onSelect={onSelect}
      onClose={onClose}
      placeholder="Search providers..."
    />
  )
}
