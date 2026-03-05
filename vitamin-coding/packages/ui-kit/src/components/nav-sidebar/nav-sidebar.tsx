import {
  ActionIcon,
  Box,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core'
import type { ReactNode } from 'react'
import type { VitaminColorTokens } from '../../tokens/colors'

interface NavItem {
  id: string
  label: string
  icon: ReactNode
  onClick?: () => void
}

interface NavSidebarProps {
  /** 顶部品牌区域 */
  brand?: ReactNode
  /** 主要操作按钮（如"新建对话"） */
  primaryAction?: ReactNode
  /** 搜索区域 */
  search?: ReactNode
  /** 中间主内容（会话列表等） */
  children: ReactNode
  /** 底部固定导航项 */
  bottomItems?: NavItem[]
  /** 当前激活的底部导航项 ID */
  activeBottomItem?: string
  /** 是否折叠 */
  collapsed?: boolean
  /** 折叠切换回调 */
  onToggleCollapse?: () => void
}

export function NavSidebar(props: NavSidebarProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Stack
      gap={0}
      style={{
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 品牌区域 */}
      {props.brand ? (
        <Box p="sm" style={{ flexShrink: 0 }}>
          {props.brand}
        </Box>
      ) : null}

      {/* 主要操作 */}
      {props.primaryAction ? (
        <Box px="sm" pb="xs" style={{ flexShrink: 0 }}>
          {props.primaryAction}
        </Box>
      ) : null}

      {/* 搜索 */}
      {props.search ? (
        <Box px="sm" pb="xs" style={{ flexShrink: 0 }}>
          {props.search}
        </Box>
      ) : null}

      {/* 中间内容 — 可滚动 */}
      <ScrollArea style={{ flex: 1 }} scrollbarSize={4} type="auto">
        <Box px="sm" py="xs">
          {props.children}
        </Box>
      </ScrollArea>

      {/* 底部分割线 + 固定导航 */}
      {props.bottomItems && props.bottomItems.length > 0 ? (
        <Box
          px="sm"
          py="xs"
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${tokens.divider.regular}`,
          }}
        >
          <Stack gap={2}>
            {props.bottomItems.map((item) => {
              const isActive = props.activeBottomItem === item.id
              return (
                <Tooltip
                  key={item.id}
                  label={item.label}
                  position="right"
                  disabled={!props.collapsed}
                >
                  <UnstyledButton
                    onClick={item.onClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: theme.radius.md,
                      background: isActive
                        ? tokens.nav.buttonBgActive
                        : tokens.nav.buttonBg,
                      color: isActive
                        ? tokens.nav.textActive
                        : tokens.nav.text,
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          tokens.nav.buttonBgHover
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isActive
                        ? tokens.nav.buttonBgActive
                        : tokens.nav.buttonBg
                    }}
                  >
                    <Box style={{ flexShrink: 0, width: 20, height: 20 }}>
                      {item.icon}
                    </Box>
                    {!props.collapsed ? (
                      <Text size="sm" fw={isActive ? 600 : 400}>
                        {item.label}
                      </Text>
                    ) : null}
                  </UnstyledButton>
                </Tooltip>
              )
            })}
          </Stack>
        </Box>
      ) : null}

      {/* 折叠按钮 */}
      {props.onToggleCollapse ? (
        <Box
          px="sm"
          py="xs"
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${tokens.divider.subtle}`,
          }}
        >
          <Tooltip
            label={props.collapsed ? '展开侧栏' : '折叠侧栏'}
            position="right"
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={props.onToggleCollapse}
              style={{ color: tokens.text.tertiary }}
            >
              {props.collapsed ? '→' : '←'}
            </ActionIcon>
          </Tooltip>
        </Box>
      ) : null}
    </Stack>
  )
}
