import { Stack, Text, Title } from '@mantine/core'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <Stack align="center" justify="center" gap="xs" py="xl">
      {props.icon ? (
        <Text size="xl" style={{ fontSize: 48 }}>{props.icon}</Text>
      ) : null}
      <Title order={4} c="dimmed">{props.title}</Title>
      {props.description ? (
        <Text c="dimmed" size="sm" ta="center" maw={300}>{props.description}</Text>
      ) : null}
    </Stack>
  )
}
