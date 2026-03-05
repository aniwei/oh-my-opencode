import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  Grid,
  Group,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core'
import { StatusBadge, type VitaminColorTokens } from '@vitamin/ui-kit'

interface Agent {
  id: string
  name?: string
  type: string
  state?: string
  model?: string
  tokenUsage?: number
}

function mapAgentState(state: string | undefined): 'running' | 'success' | 'idle' | 'warning' {
  switch (state) {
    case 'streaming':
    case 'tool_executing':
      return 'running'
    case 'completed':
      return 'success'
    case 'error':
      return 'warning'
    default:
      return 'idle'
  }
}

export function AgentMonitor() {
  const [agents, setAgents] = useState<Agent[]>([])
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents')
      const data = (await res.json()) as Agent[]
      setAgents(data)
    } catch (e) {
      console.error('Failed to fetch agents', e)
    }
  }

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Stack gap="md" h="100%">
      <Group justify="space-between">
        <Text size="lg" fw={600} c={tokens.text.primary}>
          Agent Monitor
        </Text>
        <Text size="xs" c={tokens.text.tertiary}>
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </Text>
      </Group>

      {agents.length > 0 ? (
        <Grid gutter="md">
          {agents.map((a) => {
            const stateLabel = a.state ?? 'idle'
            const isActive = stateLabel === 'streaming' || stateLabel === 'tool_executing'
            return (
              <Grid.Col key={a.id} span={{ base: 12, sm: 6, md: 4 }}>
                <Card
                  padding="md"
                  radius="md"
                  withBorder
                  style={{
                    borderColor: isActive
                      ? tokens.brand[200]
                      : tokens.divider.regular,
                    background: tokens.card.bg,
                    transition: 'border-color 200ms ease',
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600} c={tokens.text.primary}>
                      {a.name ?? a.id}
                    </Text>
                    <StatusBadge
                      variant={mapAgentState(a.state)}
                      label={stateLabel}
                      size="xs"
                    />
                  </Group>

                  <Stack gap={4}>
                    <Group gap="xs">
                      <Text size="xs" c={tokens.text.tertiary}>
                        Type:
                      </Text>
                      <Text size="xs" c={tokens.text.secondary}>
                        {a.type}
                      </Text>
                    </Group>
                    {a.model ? (
                      <Group gap="xs">
                        <Text size="xs" c={tokens.text.tertiary}>
                          Model:
                        </Text>
                        <Text size="xs" c={tokens.text.secondary} ff="monospace">
                          {a.model}
                        </Text>
                      </Group>
                    ) : null}
                    {a.tokenUsage !== undefined ? (
                      <Group gap="xs">
                        <Text size="xs" c={tokens.text.tertiary}>
                          Tokens:
                        </Text>
                        <Text size="xs" c={tokens.text.secondary}>
                          {a.tokenUsage.toLocaleString()}
                        </Text>
                      </Group>
                    ) : null}
                  </Stack>

                  {/* Real-time indicator dot */}
                  {isActive ? (
                    <Box
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: tokens.brand[500],
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  ) : null}
                </Card>
              </Grid.Col>
            )
          })}
        </Grid>
      ) : (
        <Box py="xl" style={{ textAlign: 'center' }}>
          <Text size="sm" c={tokens.text.placeholder}>
            No active agents
          </Text>
        </Box>
      )}
    </Stack>
  )
}