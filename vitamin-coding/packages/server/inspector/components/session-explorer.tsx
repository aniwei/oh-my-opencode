import { useEffect, useState } from 'react'
import {
  Box,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  useMantineTheme,
} from '@mantine/core'
import { StatusBadge, type VitaminColorTokens } from '@vitamin/ui-kit'

interface Session {
  id: string
  status: string
  createdAt?: number
  agentCount?: number
}

function mapSessionStatus(status: string): 'success' | 'idle' | 'warning' | 'error' {
  switch (status) {
    case 'active':
      return 'success'
    case 'completed':
      return 'idle'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

export function SessionExplorer() {
  const [sessions, setSessions] = useState<Session[]>([])
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = (await res.json()) as Session[]
      setSessions(data)
    } catch (e) {
      console.error('Failed to fetch sessions', e)
    }
  }

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Stack gap="md" h="100%">
      <Group justify="space-between">
        <Text size="lg" fw={600} c={tokens.text.primary}>
          Session Explorer
        </Text>
        <Text size="xs" c={tokens.text.tertiary}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </Text>
      </Group>

      <ScrollArea style={{ flex: 1 }}>
        {sessions.length > 0 ? (
          <Paper
            radius="md"
            withBorder
            style={{
              borderColor: tokens.divider.regular,
              overflow: 'hidden',
            }}
          >
            <Table
              striped
              highlightOnHover
              verticalSpacing="sm"
              horizontalSpacing="md"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ color: tokens.text.tertiary }}>ID</Table.Th>
                  <Table.Th style={{ color: tokens.text.tertiary }}>Status</Table.Th>
                  <Table.Th style={{ color: tokens.text.tertiary }}>Created</Table.Th>
                  <Table.Th style={{ color: tokens.text.tertiary }}>Agents</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace" c={tokens.text.primary}>
                        {s.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge
                        variant={mapSessionStatus(s.status)}
                        label={s.status.toUpperCase()}
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={tokens.text.secondary}>
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleString()
                          : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={tokens.text.secondary}>
                        {s.agentCount ?? '-'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        ) : (
          <Box
            py="xl"
            style={{ textAlign: 'center' }}
          >
            <Text size="sm" c={tokens.text.placeholder}>
              No active sessions
            </Text>
          </Box>
        )}
      </ScrollArea>
    </Stack>
  )
}