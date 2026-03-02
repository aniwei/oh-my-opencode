import { Alert, Button, Group } from '@mantine/core'

interface ErrorMessageProps {
  message: string
  onRetry: () => void
}

export function ErrorMessage(props: ErrorMessageProps) {
  return (
    <Alert color="red" title="请求失败">
      <Group justify="space-between">
        <span>{props.message}</span>
        <Button size="xs" onClick={props.onRetry}>重试</Button>
      </Group>
    </Alert>
  )
}
