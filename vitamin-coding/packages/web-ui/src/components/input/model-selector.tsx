import { Select, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { modelsApi } from '../../services/models-api'
import type { ModelInfo, ModelsResponse } from '../../types/api'

interface ModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
}

export function ModelSelector(props: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<ModelsResponse['source']>('registry')

  useEffect(() => {
    let active = true
    setLoading(true)

    modelsApi.list().then((result) => {
      if (active) {
        setModels(result.models)
        setSource(result.source ?? 'registry')
      }
    }).catch(() => {
      if (active) {
        setModels([
          { id: 'claude-sonnet-4', provider: 'anthropic', displayName: 'Claude Sonnet 4', supportsVision: true },
          { id: 'gpt-5.3-codex', provider: 'openai', displayName: 'GPT-5.3-Codex', supportsVision: true },
        ])
        setSource('fallback')
      }
    }).finally(() => {
      if (active) {
        setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [])

  const data = models
    .filter((model) => typeof model.id === 'string' && model.id.length > 0)
    .map((model) => ({
      value: model.id,
      label: typeof model.displayName === 'string' && model.displayName.length > 0
        ? model.displayName
        : model.id,
    }))

  const selectedValue = data.some((item) => item.value === props.value) ? props.value : null

  return (
    <>
      <Select
        data={data}
        value={selectedValue}
        size="xs"
        placeholder="选择模型"
        searchable
        nothingFoundMessage="无匹配模型"
        disabled={loading}
        onChange={(value) => {
          if (value) {
            props.onChange(value)
          }
        }}
      />
      {source === 'fallback' ? (
        <Text c="yellow" mt={4} size="xs">
          当前模型列表来自 fallback，后端模型注册表不可用。
        </Text>
      ) : null}
    </>
  )
}
