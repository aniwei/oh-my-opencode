import { useEffect, useState } from 'react'
import {
  Box,
  Code,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core'
import type { VitaminColorTokens } from '@vitamin/ui-kit'

interface MessageEntry {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  toolName?: string
  tokenCount?: number
}

const ROLE_CONFIG: Record<string, { color: string; border: string; label: string }> = {
  system: { color: '#f0f4ff', border: '#6366f1', label: 'System' },
  user: { color: '#f0fdf4', border: '#22c55e', label: 'User' },
  assistant: { color: '#fef9ee', border: '#f59e0b', label: 'Assistant' },
  tool: { color: '#fdf2f8', border: '#ec4899', label: 'Tool' },
}

export function MessageInspector() {
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sessionFilter, setSessionFilter] = useState('')
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const url = sessionFilter
          ? `/api/logs?sources=message&session=${sessionFilter}`
          : '/api/logs?sources=message'
        const res = await fetch(url)
        if (res.ok) {
          const data = (await res.json()) as MessageEntry[]
          setMessages(data)
        }
      } catch {
        /* polling failure — silent */
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [sessionFilter])

  const selected = messages.find((m) => m.id === selectedId)

  return (
    <Stack gap="md" h="100%">
      <Group gap="sm">
        <Text size="lg" fw={600} c={tokens.text.primary}>
          Message Inspector
        </Text>
        <TextInput
          placeholder="Filter by Session ID..."
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.currentTarget.value)}
          size="xs"
          style={{ flex: 1, maxWidth: 300 }}
        />
      </Group>

      <Box style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
        {/* Message list */}
        <ScrollArea style={{ flex: 1 }}>
          <Stack gap={4}>
            {messages.map((msg) => {
              const config = ROLE_CONFIG[msg.role] ?? ROLE_CONFIG.system
              const isSelected = msg.id === selectedId
              return (
                <UnstyledButton
                  key={msg.id}
                  onClick={() => setSelectedId(msg.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: isSelected ? tokens.state.accentHover : config.color,
                    borderLeft: `4px solid ${config.border}`,
                    borderRadius: theme.radius.sm,
                    transition: 'background 150ms ease',
                  }}
                >
                  <Group justify="space-between" mb={2}>
                    <Text size="xs" fw={700} c={config.border}>
                      {config.label}
                    </Text>
                    <Text size="xs" c={tokens.text.tertiary}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </Text>
                  </Group>
                  <Text
                    size="xs"
                    c={tokens.text.secondary}
                    lineClamp={1}
                  >
                    {msg.toolName ? `[${msg.toolName}] ` : ''}
                    {msg.content.slice(0, 120)}
                  </Text>
                </UnstyledButton>
              )
            })}
            {messages.length === 0 && (
              <Box py="xl" style={{ textAlign: 'center' }}>
                <Text size="sm" c={tokens.text.placeholder}>
                  No messages yet
                </Text>
              </Box>
            )}
          </Stack>
        </ScrollArea>

        {/* Detail panel */}
        {selected ? (
          <Paper
            radius="md"
            withBorder
            p="md"
            style={{
              width: 400,
              flexShrink: 0,
              borderColor: tokens.divider.regular,
              background: tokens.panel.bg,
              overflow: 'auto',
            }}
          >
            <Text size="sm" fw={600} mb="sm" c={tokens.text.primary}>
              Message Detail
            </Text>
            <Stack gap={4} mb="sm">
              <Group gap="xs">
                <Text size="xs" c={tokens.text.tertiary}>ID:</Text>
                <Text size="xs" c={tokens.text.secondary} ff="monospace">{selected.id}</Text>
              </Group>
              <Group gap="xs">
                <Text size="xs" c={tokens.text.tertiary}>Role:</Text>
                <Text size="xs" c={tokens.text.secondary}>{selected.role}</Text>
              </Group>
              <Group gap="xs">
                <Text size="xs" c={tokens.text.tertiary}>Time:</Text>
                <Text size="xs" c={tokens.text.secondary}>
                  {new Date(selected.timestamp).toLocaleString()}
                </Text>
              </Group>
              {selected.toolName ? (
                <Group gap="xs">
                  <Text size="xs" c={tokens.text.tertiary}>Tool:</Text>
                  <Text size="xs" c={tokens.text.secondary}>{selected.toolName}</Text>
                </Group>
              ) : null}
              {selected.tokenCount !== undefined ? (
                <Group gap="xs">
                  <Text size="xs" c={tokens.text.tertiary}>Tokens:</Text>
                  <Text size="xs" c={tokens.text.secondary}>
                    {selected.tokenCount.toLocaleString()}
                  </Text>
                </Group>
              ) : null}
            </Stack>
            <Code
              block
              style={{
                background: tokens.bg.soft,
                color: tokens.text.primary,
                fontSize: 12,
                maxHeight: 400,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {selected.content}
            </Code>
          </Paper>
        ) : null}
      </Box>
    </Stack>
  )
}
