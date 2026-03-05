import { Group, Text, useMantineTheme } from '@mantine/core'
import type { ReactNode } from 'react'
import type { VitaminColorTokens } from '../../tokens/colors'

interface PageHeaderProps {
  /** 左侧标题 */
  title: string
  /** 左侧图标 (可选) */
  icon?: ReactNode
  /** 右侧操作区 */
  actions?: ReactNode
  /** 中间区域 (如模型选择器) */
  center?: ReactNode
}

export function PageHeader(props: PageHeaderProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Group h="100%" justify="space-between" px="md" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        {props.icon ?? null}
        <Text
          fw={700}
          size="md"
          style={{
            color: tokens.text.logo,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {props.title}
        </Text>
      </Group>

      {props.center ?? null}

      <Group gap="xs" wrap="nowrap">
        {props.actions ?? null}
      </Group>
    </Group>
  )
}
