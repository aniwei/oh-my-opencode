import {
  Badge, Group, Paper, Stack, Text, Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { agentApi, type AgentInfo } from '../services/agent-api'

export function SettingsAgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])

  useEffect(() => {
    agentApi.list()
      .then((result) => setAgents(result.agents))
      .catch(() => setAgents([]))
  }, [])

  return (
    <Stack gap="md" maw={600}>
      <Title order={3}>Agent 管理</Title>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>可用 Agent</Text>
            <Text c="dimmed" size="xs">{agents.length} 个 Agent</Text>
          </Group>
          {agents.map((agent) => (
            <Paper key={agent.id} p="sm" radius="sm" withBorder>
              <Stack gap={4}>
                <Text fw={600} size="sm">{agent.name}</Text>
                <Text c="dimmed" size="xs">{agent.description}</Text>
                <Group gap={4}>
                  {agent.capabilities.map((cap) => (
                    <Badge key={cap} size="xs" variant="light">{cap}</Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          ))}
          {agents.length === 0 ? (
            <Text c="dimmed" size="sm">暂无可用 Agent（请检查 API 连接）</Text>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  )
}
