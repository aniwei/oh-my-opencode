import { Badge as MantineBadge } from '@mantine/core'

export type StatusVariant = 'idle' | 'running' | 'success' | 'error' | 'pending' | 'stopped'

interface StatusBadgeProps {
  status: StatusVariant
  label?: string
}

const STATUS_CONFIG: Record<StatusVariant, { color: string; label: string }> = {
  idle: { color: 'gray', label: '就绪' },
  running: { color: 'blue', label: '运行中' },
  success: { color: 'green', label: '成功' },
  error: { color: 'red', label: '失败' },
  pending: { color: 'yellow', label: '等待中' },
  stopped: { color: 'orange', label: '已停止' },
}

export function StatusBadge(props: StatusBadgeProps) {
  const config = STATUS_CONFIG[props.status]

  return (
    <MantineBadge color={config.color} variant="light" size="sm">
      {props.label ?? config.label}
    </MantineBadge>
  )
}
