import { ActionIcon, Tooltip } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@vitamin/ui-kit'
import { useSettingsStore } from '../../stores/settings-store'
import { ModelSelector } from '../input/model-selector'

export function Header() {
  const navigate = useNavigate()
  const { defaultModelId, setDefaultModelId, colorScheme, setColorScheme } = useSettingsStore()

  return (
    <PageHeader
      title="Vitamin Web UI"
      icon={undefined}
      center={
        <ModelSelector value={defaultModelId} onChange={setDefaultModelId} />
      }
      actions={
        <>
          <Tooltip label={colorScheme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            <ActionIcon
              aria-label="Toggle theme"
              variant="subtle"
              onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
            >
              {colorScheme === 'dark' ? '\u2600' : '\u263E'}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Settings">
            <ActionIcon aria-label="Settings" variant="subtle" onClick={() => navigate('/app/settings')}>
              \u2699
            </ActionIcon>
          </Tooltip>
        </>
      }
    />
  )
}
