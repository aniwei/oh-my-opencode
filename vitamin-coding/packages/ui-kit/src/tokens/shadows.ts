// 阴影尺度 — 参考 Dify shadow-1 → shadow-10
export const shadows = {
  /** 微弱阴影 — 卡片悬停 */
  xs: '0 1px 2px rgba(9, 9, 11, 0.03)',
  /** 小阴影 — 默认卡片 */
  sm: '0 1px 2px rgba(9, 9, 11, 0.05), 0 1px 3px rgba(9, 9, 11, 0.04)',
  /** 中阴影 — 浮层、Popover */
  md: '0 2px 4px rgba(9, 9, 11, 0.05), 0 4px 6px rgba(9, 9, 11, 0.04)',
  /** 大阴影 — 模态框 */
  lg: '0 4px 8px rgba(9, 9, 11, 0.06), 0 8px 16px rgba(9, 9, 11, 0.05)',
  /** 特大阴影 — Toast、Dropdown */
  xl: '0 8px 16px rgba(9, 9, 11, 0.08), 0 16px 32px rgba(9, 9, 11, 0.06)',
  /** 顶层阴影 — 全屏 overlay */
  '2xl': '0 16px 32px rgba(9, 9, 11, 0.12), 0 24px 64px rgba(9, 9, 11, 0.08)',
} as const

export const darkShadows = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.2)',
  sm: '0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)',
  md: '0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2)',
  lg: '0 4px 8px rgba(0, 0, 0, 0.35), 0 8px 16px rgba(0, 0, 0, 0.25)',
  xl: '0 8px 16px rgba(0, 0, 0, 0.4), 0 16px 32px rgba(0, 0, 0, 0.3)',
  '2xl': '0 16px 32px rgba(0, 0, 0, 0.5), 0 24px 64px rgba(0, 0, 0, 0.4)',
} as const

export type VitaminShadows = typeof shadows
