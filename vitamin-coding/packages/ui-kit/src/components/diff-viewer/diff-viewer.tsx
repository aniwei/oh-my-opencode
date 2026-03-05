import { Box, Group, ScrollArea, Text, useMantineTheme } from '@mantine/core'
import type { VitaminColorTokens } from '../../tokens/colors'

interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

interface DiffViewerProps {
  lines: DiffLine[]
  filename?: string
  maxHeight?: number | string
}

export function DiffViewer(props: DiffViewerProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const getLineStyles = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return {
          bg: tokens.state.successHover,
          color: tokens.text.success,
          prefix: '+',
        }
      case 'remove':
        return {
          bg: tokens.state.destructiveHover,
          color: tokens.text.destructive,
          prefix: '-',
        }
      case 'context':
        return {
          bg: 'transparent',
          color: tokens.text.secondary,
          prefix: ' ',
        }
    }
  }

  return (
    <Box
      style={{
        borderRadius: theme.radius.md,
        border: `1px solid ${tokens.divider.regular}`,
        overflow: 'hidden',
      }}
    >
      {props.filename ? (
        <Group
          px="sm"
          py={6}
          gap="xs"
          style={{
            background: tokens.bg.burn,
            borderBottom: `1px solid ${tokens.divider.subtle}`,
          }}
        >
          <Text size="xs" fw={500} c="dimmed" ff="monospace">
            {props.filename}
          </Text>
        </Group>
      ) : null}
      <ScrollArea
        style={{ maxHeight: props.maxHeight ?? 400 }}
        scrollbarSize={6}
      >
        <Box
          component="pre"
          style={{
            margin: 0,
            fontFamily: theme.fontFamilyMonospace,
            fontSize: '13px',
            lineHeight: 1.6,
          }}
        >
          {props.lines.map((line, index) => {
            const styles = getLineStyles(line.type)
            return (
              <Box
                key={index}
                style={{
                  display: 'flex',
                  background: styles.bg,
                  paddingLeft: 8,
                  paddingRight: 8,
                }}
              >
                <Text
                  component="span"
                  size="xs"
                  ff="monospace"
                  style={{
                    width: 40,
                    textAlign: 'right',
                    paddingRight: 8,
                    color: tokens.text.quaternary,
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  {line.oldLineNumber ?? ''}
                </Text>
                <Text
                  component="span"
                  size="xs"
                  ff="monospace"
                  style={{
                    width: 40,
                    textAlign: 'right',
                    paddingRight: 8,
                    color: tokens.text.quaternary,
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  {line.newLineNumber ?? ''}
                </Text>
                <Text
                  component="span"
                  size="xs"
                  ff="monospace"
                  style={{
                    color: styles.color,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    flex: 1,
                  }}
                >
                  {styles.prefix}{line.content}
                </Text>
              </Box>
            )
          })}
        </Box>
      </ScrollArea>
    </Box>
  )
}
