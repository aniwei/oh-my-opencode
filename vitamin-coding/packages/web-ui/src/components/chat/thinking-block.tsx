import { Box, Collapse, Group, Text, UnstyledButton, useMantineTheme } from '@mantine/core'
import { useState } from 'react'
import type { VitaminColorTokens } from '@vitamin/ui-kit'

interface ThinkingBlockProps {
  content: string
}

export function ThinkingBlock(props: ThinkingBlockProps) {
  const [opened, setOpened] = useState(false)
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Box
      style={{
        borderRadius: theme.radius.md,
        background: tokens.bg.soft,
        border: `1px solid ${tokens.divider.subtle}`,
        padding: '8px 12px',
      }}
    >
      <UnstyledButton onClick={() => setOpened((value) => !value)}>
        <Group gap={6}>
          <Text size="xs" style={{ color: tokens.text.tertiary }}>
            {opened ? '\u25BC' : '\u25B6'} Thinking
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse in={opened}>
        <Text size="sm" mt="xs" style={{ color: tokens.text.secondary, whiteSpace: 'pre-wrap' }}>
          {props.content}
        </Text>
      </Collapse>
    </Box>
  )
}
