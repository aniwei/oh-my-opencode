import { Group, Select, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { modelsApi } from '../../services/models-api'
import type { ModelInfo } from '../../types/api'

interface ModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
}

export function ModelSelector(props: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)

    modelsApi.list().then((result) => {
      if (active) {
        setModels(result.models)
      }
    }).catch(() => {
      if (active) {
        setModels([
          { id: 'claude-sonnet-4', provider: 'anthropic', displayName: 'Claude Sonnet 4', supportsVision: true },
          { id: 'gpt-5.3-codex', provider: 'openai', displayName: 'GPT-5.3-Codex', supportsVision: true },
        ])
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

  const data = models.map((model) => ({
    value: model.id,
    label: model.displayName,
    group: model.provider,
  }))

  return (
    <Select
      data={data}
      value={props.value}
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
  )
}
