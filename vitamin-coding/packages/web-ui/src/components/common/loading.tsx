import { Center, Loader, Stack, Text } from '@mantine/core'

interface LoadingSpinnerProps {
  label?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export function LoadingSpinner(props: LoadingSpinnerProps) {
  return (
    <Center>
      <Stack align="center" gap="xs">
        <Loader size={props.size ?? 'md'} />
        {props.label ? <Text c="dimmed" size="sm">{props.label}</Text> : null}
      </Stack>
    </Center>
  )
}
