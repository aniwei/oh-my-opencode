import { Text } from '@mantine/core'

interface SessionGroupProps {
  title: string
}

export function SessionGroup(props: SessionGroupProps) {
  return (
    <Text c="dimmed" fw={700} size="xs" tt="uppercase">
      {props.title}
    </Text>
  )
}
