import { useEffect, useState } from 'react'
import {
  Box,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  useMantineTheme,
} from '@mantine/core'
import type { VitaminColorTokens } from '@vitamin/ui-kit'

interface ToolTimelineEntry {
  id: string
  name: string
  agentId: string
  startTime: number
  endTime?: number
  status: 'running' | 'success' | 'error'
  durationMs?: number
}

const STATUS_COLORS: Record<string, string> = {
  running: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444',
}

export function ToolsTimeline() {
  const [entries, setEntries] = useState<ToolTimelineEntry[]>([])
  const [timeRange, setTimeRange] = useState<{ start: number; end: number }>({
    start: Date.now() - 60_000,
    end: Date.now(),
  })
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/logs?sources=tool&limit=100')
        if (res.ok) {
          const data = (await res.json()) as ToolTimelineEntry[]
          setEntries(data)

          if (data.length > 0) {
            const starts = data.map((d) => d.startTime)
            const ends = data.map((d) => d.endTime ?? Date.now())
            setTimeRange({
              start: Math.min(...starts),
              end: Math.max(...ends),
            })
          }
        }
      } catch {
        /* polling failure — silent */
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [])

  const totalDuration = Math.max(timeRange.end - timeRange.start, 1)

  const agentGroups = new Map<string, ToolTimelineEntry[]>()
  for (const entry of entries) {
    const group = agentGroups.get(entry.agentId) ?? []
    group.push(entry)
    agentGroups.set(entry.agentId, group)
  }

  return (
    <Stack gap="md" h="100%">
      <Group justify="space-between">
        <Text size="lg" fw={600} c={tokens.text.primary}>
          Tools Timeline
        </Text>
        <Text size="xs" c={tokens.text.tertiary}>
          {entries.length} tool call{entries.length !== 1 ? 's' : ''} ·{' '}
          {new Date(timeRange.start).toLocaleTimeString()} →{' '}
          {new Date(timeRange.end).toLocaleTimeString()}
        </Text>
      </Group>

      <ScrollArea style={{ flex: 1 }}>
        {/* Time scale */}
        <Box
          style={{
            position: 'relative',
            height: 24,
            borderBottom: `1px solid ${tokens.divider.regular}`,
            marginBottom: 12,
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <Text
              key={pct}
              size="xs"
              c={tokens.text.tertiary}
              style={{
                position: 'absolute',
                left: `${pct * 100}%`,
                transform: 'translateX(-50%)',
                top: 2,
              }}
            >
              {new Date(timeRange.start + totalDuration * pct).toLocaleTimeString()}
            </Text>
          ))}
        </Box>

        {/* Gantt chart rows */}
        <Stack gap="md">
          {[...agentGroups.entries()].map(([agentId, tools]) => (
            <Box key={agentId}>
              <Text size="xs" fw={600} c={tokens.text.primary} mb={4} ff="monospace">
                {agentId}
              </Text>
              <Paper
                radius="sm"
                style={{
                  position: 'relative',
                  height: tools.length * 28 + 4,
                  background: tokens.bg.soft,
                  overflow: 'hidden',
                }}
              >
                {tools.map((tool, idx) => {
                  const left = ((tool.startTime - timeRange.start) / totalDuration) * 100
                  const width = (((tool.endTime ?? Date.now()) - tool.startTime) / totalDuration) * 100
                  const barColor = STATUS_COLORS[tool.status] ?? STATUS_COLORS.running
                  const tooltipLabel = `${tool.name} — ${tool.durationMs !== undefined ? `${tool.durationMs}ms` : 'running'}`

                  return (
                    <Tooltip key={tool.id} label={tooltipLabel} position="top">
                      <Box
                        style={{
                          position: 'absolute',
                          top: idx * 28 + 2,
                          left: `${Math.max(0, left)}%`,
                          width: `${Math.max(0.5, Math.min(width, 100 - Math.max(0, left)))}%`,
                          height: 24,
                          background: barColor,
                          borderRadius: theme.radius.sm,
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 6,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Text size="xs" c="white" fw={500}>
                          {tool.name}
                          {tool.durationMs !== undefined ? ` (${tool.durationMs}ms)` : ''}
                        </Text>
                      </Box>
                    </Tooltip>
                  )
                })}
              </Paper>
            </Box>
          ))}
        </Stack>

        {entries.length === 0 && (
          <Box py="xl" style={{ textAlign: 'center' }}>
            <Text size="sm" c={tokens.text.placeholder}>
              No tool calls recorded
            </Text>
          </Box>
        )}
      </ScrollArea>
    </Stack>
  )
}
