import { Paper, ScrollArea, useMantineTheme } from '@mantine/core'
import type { VitaminColorTokens } from '@vitamin/ui-kit'

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
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens
  const text = formatOutput(props.output)
  const isLong = text.length > 500

  return (
    <Paper p="xs" radius="md" style={{ background: tokens.bg.burn, border: `1px solid ${tokens.divider.regular}` }}>
      <ScrollArea.Autosize mah={isLong ? 200 : undefined}>
        <pre style={{ margin: 0, fontSize: '0.8em', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {text}
        </pre>
      </ScrollArea.Autosize>
    </Paper>
  )
}
