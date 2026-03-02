import { Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'

interface Command {
  name: string
  description: string
}

const BUILTIN_COMMANDS: Command[] = [
  { name: '/plan', description: '进入 Plan 模式，先规划后执行' },
  { name: '/roundtable', description: '启动圆桌讨论，多角色脑暴' },
  { name: '/compact', description: '压缩当前对话上下文' },
  { name: '/build', description: '进入 Build 模式，直接执行' },
  { name: '/agent', description: '选择指定 Agent 执行任务' },
  { name: '/help', description: '显示帮助信息' },
]

interface CommandPaletteProps {
  visible: boolean
  filter?: string
  onPick: (command: string) => void
}

export function CommandPalette(props: CommandPaletteProps) {
  const [selected, setSelected] = useState(0)

  const filtered = BUILTIN_COMMANDS.filter((cmd) => {
    if (!props.filter) {
      return true
    }

    return cmd.name.includes(props.filter.toLowerCase())
  })

  useEffect(() => {
    setSelected(0)
  }, [props.filter])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!props.visible || filtered.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((prev) => (prev + 1) % filtered.length)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((prev) => (prev - 1 + filtered.length) % filtered.length)
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const cmd = filtered[selected]
      if (cmd) {
        props.onPick(cmd.name)
      }
    }

    if (event.key === 'Escape') {
      props.onPick('')
    }
  }, [props.visible, filtered, selected, props.onPick])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!props.visible || filtered.length === 0) {
    return null
  }

  return (
    <Paper p="xs" radius="md" shadow="sm" withBorder>
      <Stack gap={2}>
        {filtered.map((command, index) => (
          <UnstyledButton
            key={command.name}
            onClick={() => props.onPick(command.name)}
            onMouseEnter={() => setSelected(index)}
            p={6}
            style={{
              borderRadius: 6,
              background: index === selected ? 'var(--mantine-color-dark-5)' : 'transparent',
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <Text fw={600} size="sm">{command.name}</Text>
              <Text c="dimmed" size="xs">{command.description}</Text>
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Paper>
  )
}
