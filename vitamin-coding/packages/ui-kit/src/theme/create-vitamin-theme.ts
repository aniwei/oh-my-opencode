import { createTheme, type MantineThemeOverride } from '@mantine/core'
import { lightColors, darkColors, type VitaminColorTokens } from '../tokens/colors'
import { shadows, darkShadows } from '../tokens/shadows'
import { typography } from '../tokens/typography'

// Mantine primaryColor 色阶（10 级） — 基于 Dify blue-brand 色阶映射
const brandPalette = [
  '#f5f7ff', // 0 → brand.50
  '#eff4ff', // 1
  '#d1e0ff', // 2 → brand.100
  '#b2caff', // 3 → brand.200
  '#84abff', // 4 → brand.300
  '#5289ff', // 5 → brand.400
  '#296dff', // 6 → brand.500
  '#155aef', // 7 → brand.600 (primary shade)
  '#004aeb', // 8 → brand.700
  '#00329e', // 9 (deepest)
] as const

// radius 规范：对标 Dify 圆角定义
const radius = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
}

export function createVitaminTheme(
  colorScheme: 'light' | 'dark' = 'light',
): MantineThemeOverride {
  const tokens: VitaminColorTokens =
    colorScheme === 'light' ? lightColors : darkColors
  const currentShadows = colorScheme === 'light' ? shadows : darkShadows

  return createTheme({
    primaryColor: 'brand',
    primaryShade: 7,
    colors: {
      brand: [...brandPalette],
    },
    defaultRadius: 'md',
    fontFamily: typography.fontFamily.sans,
    fontFamilyMonospace: typography.fontFamily.mono,
    radius,
    shadows: currentShadows,
    headings: {
      fontWeight: '600',
      sizes: {
        h1: { fontSize: typography.headings.h1.fontSize, lineHeight: String(typography.headings.h1.lineHeight) },
        h2: { fontSize: typography.headings.h2.fontSize, lineHeight: String(typography.headings.h2.lineHeight) },
        h3: { fontSize: typography.headings.h3.fontSize, lineHeight: String(typography.headings.h3.lineHeight) },
        h4: { fontSize: typography.headings.h4.fontSize, lineHeight: String(typography.headings.h4.lineHeight) },
        h5: { fontSize: typography.headings.h5.fontSize, lineHeight: String(typography.headings.h5.lineHeight) },
        h6: { fontSize: typography.headings.h6.fontSize, lineHeight: String(typography.headings.h6.lineHeight) },
      },
    },
    other: tokens,
  })
}

export { type VitaminColorTokens }
