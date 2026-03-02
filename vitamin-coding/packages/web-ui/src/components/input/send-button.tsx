import { Button } from '@mantine/core'

interface SendButtonProps {
  loading: boolean
  disabled: boolean
  onClick: () => void
}

export function SendButton(props: SendButtonProps) {
  return (
    <Button loading={props.loading} disabled={props.disabled} onClick={props.onClick}>
      发送
    </Button>
  )
}
