import { Paper, ScrollArea } from '@mantine/core'

interface ToolResultProps {
  output: unknown
}

function formatOutput(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

export function ToolResult(props: ToolResultProps) {
  const text = formatOutput(props.output)
  const isLong = text.length > 500

  return (
    <Paper p="xs" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-7)' }}>
      <ScrollArea.Autosize mah={isLong ? 200 : undefined}>
        <pre style={{ margin: 0, fontSize: '0.8em', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {text}
        </pre>
      </ScrollArea.Autosize>
    </Paper>
  )
}
