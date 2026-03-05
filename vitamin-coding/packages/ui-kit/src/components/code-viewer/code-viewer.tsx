import { Box, ScrollArea, useMantineTheme } from '@mantine/core'
import type { VitaminColorTokens } from '../../tokens/colors'

interface CodeViewerProps {
  code: string
  language?: string
  maxHeight?: number | string
}

export function CodeViewer(props: CodeViewerProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Box
      style={{
        borderRadius: theme.radius.md,
        border: `1px solid ${tokens.divider.regular}`,
        overflow: 'hidden',
      }}
    >
      {props.language ? (
        <Box
          px="sm"
          py={4}
          style={{
            background: tokens.bg.burn,
            borderBottom: `1px solid ${tokens.divider.subtle}`,
            fontSize: '11px',
            color: tokens.text.tertiary,
            fontFamily: theme.fontFamilyMonospace,
          }}
        >
          {props.language}
        </Box>
      ) : null}
      <ScrollArea
        style={{ maxHeight: props.maxHeight ?? 400 }}
        scrollbarSize={6}
      >
        <Box
          component="pre"
          p="sm"
          style={{
            margin: 0,
            fontFamily: theme.fontFamilyMonospace,
            fontSize: '13px',
            lineHeight: 1.6,
            color: tokens.text.primary,
            background: tokens.card.bg,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {props.code}
        </Box>
      </ScrollArea>
    </Box>
  )
}
