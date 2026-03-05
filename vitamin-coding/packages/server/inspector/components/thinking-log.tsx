import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Checkbox,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core'
import { StatusBadge, type VitaminColorTokens } from '@vitamin/ui-kit'

interface ThinkingEntry {
  id: string
  agentId: string
  timestamp: number
  content: string
  isStreaming: boolean
}

export function ThinkingLog() {
  const [entries, setEntries] = useState<ThinkingEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const viewportRef = useRef<HTMLDivElement>(null)
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  useEffect(() => {
    let eventSource: EventSource | null = null

    try {
      eventSource = new EventSource('/api/logs/stream?sources=thinking')

      eventSource.addEventListener('log', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as ThinkingEntry
          setEntries((prev) => {
            const existing = prev.findIndex((e) => e.id === data.id)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = data
              return updated
            }
            const next = [...prev, data]
            return next.length > 200 ? next.slice(-200) : next
          })
        } catch {
          /* parse failure — silent */
        }
      })
    } catch {
      const timer = setInterval(async () => {
        try {
          const res = await fetch('/api/logs?sources=thinking&limit=50')
          if (res.ok) {
            const data = (await res.json()) as ThinkingEntry[]
            setEntries(data)
          }
        } catch {
          /* polling failure — silent */
        }
      }, 3000)

      return () => clearInterval(timer)
    }

    return () => {
      eventSource?.close()
    }
  }, [])

  useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: 'auto',
      })
    }
  }, [entries, autoScroll])

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <Stack gap="md" h="100%">
      <Group justify="space-between">
        <Text size="lg" fw={600} c={tokens.text.primary}>
          Thinking Log
        </Text>
        <Checkbox
          size="xs"
          label="Auto-scroll"
          checked={autoScroll}
          onChange={(e) => setAutoScroll(e.currentTarget.checked)}
        />
      </Group>

      <ScrollArea style={{ flex: 1 }} viewportRef={viewportRef}>
        <Stack gap={6}>
          {entries.map((entry) => {
            const isExpanded = expandedIds.has(entry.id)
            const preview = entry.content.slice(0, 200)
            const needsExpand = entry.content.length > 200

            return (
              <Paper
                key={entry.id}
                radius="sm"
                p="sm"
                style={{
                  background: entry.isStreaming
                    ? tokens.status.warningBg
                    : tokens.bg.soft,
                  borderLeft: `3px solid ${
                    entry.isStreaming ? tokens.text.warning : tokens.brand[500]
                  }`,
                }}
              >
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c={tokens.text.tertiary} ff="monospace">
                    {entry.agentId}
                  </Text>
                  <Group gap="xs">
                    <Text size="xs" c={tokens.text.tertiary}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </Text>
                    {entry.isStreaming ? (
                      <StatusBadge variant="warning" label="streaming" size="xs" />
                    ) : null}
                  </Group>
                </Group>

                <Text
                  size="xs"
                  c={tokens.text.primary}
                  ff="monospace"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {isExpanded ? entry.content : preview}
                  {needsExpand && !isExpanded ? '...' : ''}
                </Text>

                {needsExpand ? (
                  <UnstyledButton
                    onClick={() => toggleExpanded(entry.id)}
                    mt={4}
                  >
                    <Text size="xs" c={tokens.text.accent}>
                      {isExpanded ? 'Collapse' : 'Show all'}
                    </Text>
                  </UnstyledButton>
                ) : null}
              </Paper>
            )
          })}
          {entries.length === 0 && (
            <Box py="xl" style={{ textAlign: 'center' }}>
              <Text size="sm" c={tokens.text.placeholder}>
                No thinking logs yet
              </Text>
            </Box>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}
