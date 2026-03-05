import { Textarea } from '@mantine/core'

interface MessageComposerProps {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
}

export function MessageComposer(props: MessageComposerProps) {
  return (
    <Textarea
      autosize
      maxRows={10}
      minRows={2}
      placeholder="Type a message... (/ for commands)"
      style={{ flex: 1 }}
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
      onKeyDown={props.onKeyDown}
      onPaste={props.onPaste}
    />
  )
}
