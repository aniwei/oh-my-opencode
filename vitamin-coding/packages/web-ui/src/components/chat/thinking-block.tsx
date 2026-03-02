import { Collapse, Group, Text, UnstyledButton } from '@mantine/core'
import { useState } from 'react'

interface ThinkingBlockProps {
  content: string
}

export function ThinkingBlock(props: ThinkingBlockProps) {
  const [opened, setOpened] = useState(false)

  return (
    <div>
      <UnstyledButton onClick={() => setOpened((value) => !value)}>
        <Group gap={6}>
          <Text c="dimmed" size="xs">{opened ? '▼' : '▶'} 思考过程</Text>
        </Group>
      </UnstyledButton>
      <Collapse in={opened}>
        <Text c="dimmed" size="sm">{props.content}</Text>
      </Collapse>
    </div>
  )
}
