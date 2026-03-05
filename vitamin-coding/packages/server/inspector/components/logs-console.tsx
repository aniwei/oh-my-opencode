import { useEffect, useState, useRef } from 'react'
import {
  Box,
  Group,
  ScrollArea,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core'
import { StatusBadge, type VitaminColorTokens } from '@vitamin/ui-kit'

interface LogEntry {
  timestamp: number
  level: string
  source: string
  message: string
  [key: string]: unknown
}

const LEVEL_COLORS: Record<string, string> = {
  error: '#d93025',
  fatal: '#d93025',
  warn: '#f29900',
  info: '#1e8e3e',
  debug: '#1a73e8',
  trace: '#80868b',
}

export function LogsConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  useEffect(() => {
    fetch('/api/logs?since=0')
      .then((r) => r.json())
      .then((data: LogEntry[]) => {
        setLogs(data)
        setTimeout(() => {
          viewportRef.current?.scrollTo({
            top: viewportRef.current.scrollHeight,
            behavior: 'smooth',
          })
        }, 100)
      })
      .catch((e) => console.error('Failed to fetch initial logs:', e))

    const es = new EventSource('/api/logs/stream?level=debug')

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data) as LogEntry
        setLogs((prev) => [...prev, log].slice(-1000))
        setTimeout(() => {
          viewportRef.current?.scrollTo({
            top: viewportRef.current.scrollHeight,
            behavior: 'auto',
          })
        }, 50)
      } catch (err) {
        console.error('Failed to parse log event', err)
      }
    })

    return () => {
      es.close()
    }
  }, [])

  const getExtraFields = (log: LogEntry): Record<string, unknown> => {
    const excluded = new Set(['timestamp', 'level', 'source', 'message'])
    const extras: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(log)) {
      if (!excluded.has(k)) {
        extras[k] = v
      }
    }
    return extras
  }

  return (
    <Stack gap="md" h="100%">
      <Group justify="space-between">
        <Text size="lg" fw={600} c={tokens.text.primary}>
          Logs Console
        </Text>
        <Group gap="xs">
          <Box
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? tokens.text.success : tokens.text.destructive,
            }}
          />
          <StatusBadge
            variant={connected ? 'success' : 'error'}
            label={connected ? 'Live' : 'Disconnected'}
            size="xs"
          />
        </Group>
      </Group>

      <Box
        style={{
          flex: 1,
          borderRadius: theme.radius.md,
          background: '#1e1e1e',
          overflow: 'hidden',
        }}
      >
        <ScrollArea style={{ height: '100%' }} viewportRef={viewportRef}>
          <Box p="xs" ff="monospace" style={{ fontSize: 13, color: '#d4d4d4' }}>
            {logs.map((log, i) => {
              const levelColor = LEVEL_COLORS[log.level] ?? '#5f6368'
              const extras = getExtraFields(log)
              const hasExtras = Object.keys(extras).length > 0

              return (
                <Box
                  key={i}
                  py={2}
                  style={{
                    borderBottom: '1px solid #333',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  <Text span size="xs" c="#858585" style={{ marginRight: 8 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                  <Text
                    span
                    size="xs"
                    fw={700}
                    c={levelColor}
                    style={{ display: 'inline-block', width: 44 }}
                  >
                    {log.level.toUpperCase()}
                  </Text>
                  <Text span size="xs" c="#569cd6" style={{ marginRight: 8 }}>
                    [{log.source}]
                  </Text>
                  <Text span size="xs" c="#ce9178">
                    {log.message}
                  </Text>
                  {hasExtras ? (
                    <Text span size="xs" c="#9cdcfe" style={{ marginLeft: 8 }}>
                      {JSON.stringify(extras)}
                    </Text>
                  ) : null}
                </Box>
              )
            })}
            {logs.length === 0 && (
              <Text size="xs" c="#858585" fs="italic">
                Waiting for logs...
              </Text>
            )}
          </Box>
        </ScrollArea>
      </Box>
    </Stack>
  )
}