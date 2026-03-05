import { createVitaminTheme } from '@vitamin/ui-kit'

export type { VitaminColorTokens } from '@vitamin/ui-kit'

export function getTheme(colorScheme: 'light' | 'dark') {
  return createVitaminTheme(colorScheme)
}

// 默认导出 - light 优先
export const theme = createVitaminTheme('light')
