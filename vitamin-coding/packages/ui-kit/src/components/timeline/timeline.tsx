import { Box, Group, Text, useMantineTheme } from '@mantine/core'
import type { ReactNode } from 'react'
import type { VitaminColorTokens } from '../../tokens/colors'

interface TimelineItem {
  id: string
  label: string
  description?: string
  timestamp?: string
  icon?: ReactNode
  color?: string
  status?: 'completed' | 'active' | 'pending'
}

interface TimelineProps {
  items: TimelineItem[]
}

export function Timeline(props: TimelineProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const getStatusColor = (status: TimelineItem['status']) => {
    switch (status) {
      case 'completed':
        return tokens.status.successBg
      case 'active':
        return tokens.brand[500]
      case 'pending':
        return tokens.text.disabled
      default:
        return tokens.brand[500]
    }
  }

  return (
    <Box>
      {props.items.map((item, index) => {
        const color = item.color ?? getStatusColor(item.status)
        const isLast = index === props.items.length - 1

        return (
          <Group
            key={item.id}
            gap="sm"
            wrap="nowrap"
            align="flex-start"
            style={{ position: 'relative' }}
          >
            {/* 时间线轨道 */}
            <Box
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                width: 24,
              }}
            >
              {/* 圆点 */}
              <Box
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  marginTop: 4,
                  flexShrink: 0,
                  boxShadow: item.status === 'active'
                    ? `0 0 0 3px ${color}33`
                    : 'none',
                }}
              />
              {/* 连线 */}
              {!isLast ? (
                <Box
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 24,
                    background: tokens.divider.regular,
                  }}
                />
              ) : null}
            </Box>

            {/* 内容区 */}
            <Box pb="sm" style={{ flex: 1 }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  {item.icon ?? null}
                  <Text
                    size="sm"
                    fw={item.status === 'active' ? 600 : 400}
                    style={{ color: tokens.text.primary }}
                  >
                    {item.label}
                  </Text>
                </Group>
                {item.timestamp ? (
                  <Text size="xs" style={{ color: tokens.text.tertiary }}>
                    {item.timestamp}
                  </Text>
                ) : null}
              </Group>
              {item.description ? (
                <Text
                  size="xs"
                  mt={2}
                  style={{ color: tokens.text.secondary }}
                >
                  {item.description}
                </Text>
              ) : null}
            </Box>
          </Group>
        )
      })}
    </Box>
  )
}
