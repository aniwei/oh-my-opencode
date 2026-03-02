import { Avatar as MantineAvatar } from '@mantine/core'
import type { MessageRole } from '../../types/message'

interface RoleAvatarProps {
  role: MessageRole
  name?: string
  size?: number
}

const ROLE_COLORS: Record<MessageRole, string> = {
  user: 'blue',
  assistant: 'grape',
  system: 'gray',
}

const ROLE_LABELS: Record<MessageRole, string> = {
  user: 'U',
  assistant: 'V',
  system: 'S',
}

export function RoleAvatar(props: RoleAvatarProps) {
  const size = props.size ?? 32

  return (
    <MantineAvatar
      size={size}
      radius="xl"
      color={ROLE_COLORS[props.role]}
      variant="filled"
    >
      {props.name?.[0]?.toUpperCase() ?? ROLE_LABELS[props.role]}
    </MantineAvatar>
  )
}
