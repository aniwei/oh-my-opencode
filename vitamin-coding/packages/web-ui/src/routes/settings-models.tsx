import {
  ActionIcon, Button, Group, Paper, PasswordInput, Select, Stack, Text, TextInput, Title,
} from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { modelsApi } from '../services/models-api'
import { useSettingsStore } from '../stores/settings-store'
import type { ModelInfo, ModelsResponse } from '../types/api'

interface ProviderConfig {
  id: string
  provider: string
  apiKey: string
  baseUrl: string
}

const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'bedrock', label: 'AWS Bedrock' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
]

export function SettingsModelsPage() {
  const { defaultModelId, setDefaultModelId } = useSettingsStore()
  const [models, setModels] = useState<ModelInfo[]>([])
  const [source, setSource] = useState<ModelsResponse['source']>('registry')
  const [providers, setProviders] = useState<ProviderConfig[]>([])

  useEffect(() => {
    modelsApi.list()
      .then((result) => {
        setModels(result.models)
        setSource(result.source ?? 'registry')
      })
      .catch(() => {
        setModels([])
        setSource('fallback')
      })
  }, [])

  const addProvider = useCallback(() => {
    setProviders((prev) => [
      ...prev,
      { id: `provider-${Date.now()}`, provider: 'openai-compatible', apiKey: '', baseUrl: '' },
    ])
  }, [])

  const removeProvider = useCallback((id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const updateProvider = useCallback((id: string, updates: Partial<ProviderConfig>) => {
    setProviders((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p))
  }, [])

  return (
    <Stack gap="md" maw={600}>
      <Title order={3}>模型管理</Title>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>默认模型</Text>
          <Select
            data={models.map((m) => ({ value: m.id, label: m.displayName, group: m.provider }))}
            value={defaultModelId}
            placeholder="选择默认模型"
            searchable
            onChange={(value) => {
              if (value) {
                setDefaultModelId(value)
              }
            }}
          />
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>可用模型</Text>
            <Group gap={8}>
              <Text c="dimmed" size="xs">{models.length} 个模型</Text>
              {source === 'fallback' ? (
                <Text c="yellow" size="xs">fallback</Text>
              ) : null}
            </Group>
          </Group>
          {models.map((model) => (
            <Group key={model.id} justify="space-between">
              <Stack gap={0}>
                <Text size="sm">{model.displayName}</Text>
                <Text c="dimmed" size="xs">{model.provider}</Text>
              </Stack>
              {model.supportsVision ? (
                <Text size="xs" c="blue">支持视觉</Text>
              ) : null}
            </Group>
          ))}
          {models.length === 0 ? (
            <Text c="dimmed" size="sm">暂无可用模型（请检查 API 连接）</Text>
          ) : null}
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>Provider 配置</Text>
            <Button size="xs" variant="light" onClick={addProvider}>添加 Provider</Button>
          </Group>
          {providers.map((config) => (
            <Paper key={config.id} p="sm" radius="sm" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Select
                    data={PROVIDER_OPTIONS}
                    value={config.provider}
                    size="xs"
                    onChange={(value) => {
                      if (value) {
                        updateProvider(config.id, { provider: value })
                      }
                    }}
                  />
                  <ActionIcon
                    aria-label="移除"
                    color="red"
                    size="sm"
                    variant="subtle"
                    onClick={() => removeProvider(config.id)}
                  >
                    ×
                  </ActionIcon>
                </Group>
                <PasswordInput
                  placeholder="API Key"
                  size="xs"
                  value={config.apiKey}
                  onChange={(event) => updateProvider(config.id, { apiKey: event.currentTarget.value })}
                />
                <TextInput
                  placeholder="Base URL (可选)"
                  size="xs"
                  value={config.baseUrl}
                  onChange={(event) => updateProvider(config.id, { baseUrl: event.currentTarget.value })}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Paper>
    </Stack>
  )
}
