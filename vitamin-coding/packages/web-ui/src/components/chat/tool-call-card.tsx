import { Badge, Box, Collapse, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import type { ToolCall } from '../../types/message'
import { formatDuration } from '../../utils/format-time'
import { ToolResult } from './tool-result'

interface ToolCallCardProps {
  tool: ToolCall
}

const STATUS_COLOR: Record<ToolCall['status'], string> = {
  pending: 'gray',
  running: 'blue',
  success: 'green',
  error: 'red',
}

const STATUS_LABEL: Record<ToolCall['status'], string> = {
  pending: 'Pending',
  running: 'Running',
  success: 'Success',
  error: 'Error',
}

export function ToolCallCard(props: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = props.tool.input !== undefined || props.tool.output !== undefined

  return (
    <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
      <Group gap={0} wrap="nowrap">
        <Box
          style={{
            width: 4,
            alignSelf: 'stretch',
            background: `var(--mantine-color-${STATUS_COLOR[props.tool.status]}-6)`,
            transition: 'background 300ms ease',
          }}
        />
        <Stack gap={4} p="xs" style={{ flex: 1 }}>
          <UnstyledButton onClick={() => hasDetails && setExpanded((v) => !v)}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Badge color={STATUS_COLOR[props.tool.status]} variant="light" size="sm">
                  {STATUS_LABEL[props.tool.status]}
                </Badge>
                <Text fw={600} size="sm">{props.tool.name}</Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                {props.tool.durationMs !== undefined ? (
                  <Text c="dimmed" size="xs">{formatDuration(props.tool.durationMs)}</Text>
                ) : null}
                {hasDetails ? (
                  <Text c="dimmed" size="xs">{expanded ? '▼' : '▶'}</Text>
                ) : null}
              </Group>
            </Group>
          </UnstyledButton>

          <Collapse in={expanded}>
            <Stack gap="xs" mt="xs">
              {props.tool.input !== undefined ? (
                <Box>
                  <Text size="xs" style={{ color: 'var(--mantine-color-dimmed)' }} mb={4}>Input</Text>
                  <ToolResult output={props.tool.input} />
                </Box>
              ) : null}
              {props.tool.output !== undefined ? (
                <Box>
                  <Text size="xs" style={{ color: 'var(--mantine-color-dimmed)' }} mb={4}>Output</Text>
                  <ToolResult output={props.tool.output} />
                </Box>
              ) : null}
            </Stack>
          </Collapse>
        </Stack>
      </Group>
    </Paper>
  )
}
