// 字体尺度 — 参考 Dify system-xs → system-2xl
export const typography = {
  fontFamily: {
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
  },

  fontSize: {
    /** 11px — 辅助标签、badge */
    '2xs': '0.6875rem',
    /** 12px — 小文本 */
    xs: '0.75rem',
    /** 13px — 紧凑正文 */
    sm: '0.8125rem',
    /** 14px — 正文 */
    md: '0.875rem',
    /** 16px — 大正文 / 小标题 */
    lg: '1rem',
    /** 18px — 标题 */
    xl: '1.125rem',
    /** 20px — 大标题 */
    '2xl': '1.25rem',
    /** 24px — 页面标题 */
    '3xl': '1.5rem',
  },

  lineHeight: {
    '2xs': 1.2,
    xs: 1.33,
    sm: 1.38,
    md: 1.43,
    lg: 1.5,
    xl: 1.56,
    '2xl': 1.6,
    '3xl': 1.33,
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  headings: {
    h1: { fontSize: '1.5rem', lineHeight: 1.33, fontWeight: '700' },
    h2: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: '600' },
    h3: { fontSize: '1.125rem', lineHeight: 1.44, fontWeight: '600' },
    h4: { fontSize: '1rem', lineHeight: 1.5, fontWeight: '600' },
    h5: { fontSize: '0.875rem', lineHeight: 1.43, fontWeight: '600' },
    h6: { fontSize: '0.75rem', lineHeight: 1.33, fontWeight: '600' },
  },
} as const

export type VitaminTypography = typeof typography
