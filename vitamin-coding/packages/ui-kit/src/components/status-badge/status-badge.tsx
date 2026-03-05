import { Badge } from '@mantine/core'

type StatusVariant = 'success' | 'warning' | 'error' | 'running' | 'idle' | 'info'

interface StatusBadgeProps {
  variant: StatusVariant
  label: string
  size?: 'xs' | 'sm' | 'md'
}

const STATUS_CONFIG: Record<StatusVariant, { colorKey: string; mantineColor: string }> = {
  success: { colorKey: 'green', mantineColor: 'green' },
  warning: { colorKey: 'orange', mantineColor: 'orange' },
  error: { colorKey: 'red', mantineColor: 'red' },
  running: { colorKey: 'blue', mantineColor: 'blue' },
  idle: { colorKey: 'gray', mantineColor: 'gray' },
  info: { colorKey: 'cyan', mantineColor: 'cyan' },
}

export function StatusBadge(props: StatusBadgeProps) {
  const config = STATUS_CONFIG[props.variant]

  return (
    <Badge
      variant="light"
      color={config.mantineColor}
      size={props.size ?? 'sm'}
      styles={{
        root: {
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: '0.02em',
        },
      }}
    >
      {props.label}
    </Badge>
  )
}
