import { Button } from '@mantine/core'

interface NewChatButtonProps {
  onCreate: () => void
}

export function NewChatButton(props: NewChatButtonProps) {
  return (
    <Button fullWidth onClick={props.onCreate} variant="light">
      新建对话
    </Button>
  )
}
