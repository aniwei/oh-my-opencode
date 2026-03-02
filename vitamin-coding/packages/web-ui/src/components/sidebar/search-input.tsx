import { TextInput } from '@mantine/core'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
}

export function SearchInput(props: SearchInputProps) {
  return (
    <TextInput
      placeholder="搜索会话..."
      size="sm"
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
    />
  )
}
