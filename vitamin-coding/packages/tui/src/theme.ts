// 主题系统 — 颜色/样式/间距配置 + 热重载
import { TypedEventEmitter } from '@vitamin/shared'

import { COLORS, style } from './utils/ansi'

import type { EventMap } from '@vitamin/shared'

// 主题配色
export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  error: string
  warning: string
  success: string
  info: string
  text: string
  dimText: string
  border: string
  background: string
}

// 主题配置
export interface ThemeConfig {
  colors: ThemeColors
  spacing: {
    indent: number
    padding: number
  }
  symbols: {
    bullet: string
    arrow: string
    check: string
    cross: string
    spinner: string[]
  }
}

// 默认暗色主题
export const DARK_THEME: ThemeConfig = {
  colors: {
    primary: COLORS.brightCyan,
    secondary: COLORS.brightMagenta,
    accent: COLORS.brightYellow,
    error: COLORS.brightRed,
    warning: COLORS.yellow,
    success: COLORS.brightGreen,
    info: COLORS.brightBlue,
    text: COLORS.white,
    dimText: COLORS.gray,
    border: COLORS.gray,
    background: '',
  },
  spacing: {
    indent: 2,
    padding: 1,
  },
  symbols: {
    bullet: '●',
    arrow: '→',
    check: '✓',
    cross: '✗',
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
}

// 亮色主题
export const LIGHT_THEME: ThemeConfig = {
  colors: {
    primary: COLORS.cyan,
    secondary: COLORS.magenta,
    accent: COLORS.yellow,
    error: COLORS.red,
    warning: COLORS.yellow,
    success: COLORS.green,
    info: COLORS.blue,
    text: COLORS.black,
    dimText: COLORS.gray,
    border: COLORS.gray,
    background: '',
  },
  spacing: {
    indent: 2,
    padding: 1,
  },
  symbols: {
    bullet: '●',
    arrow: '→',
    check: '✓',
    cross: '✗',
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
}

// 主题事件
interface ThemeEvents extends EventMap {
  change: (theme: ThemeConfig) => void
}

// 主题管理器
export class ThemeManager extends TypedEventEmitter<ThemeEvents> {
  private current: ThemeConfig

  constructor(theme: ThemeConfig = DARK_THEME) {
    super()
    this.current = theme
  }

  // 获取当前主题
  getTheme(): ThemeConfig {
    return this.current
  }

  // 更新主题（热重载）
  setTheme(theme: ThemeConfig): void {
    this.current = theme
    this.emit('change', theme)
  }

  // 更新部分主题色
  updateColors(colors: Partial<ThemeColors>): void {
    this.current = {
      ...this.current,
      colors: { ...this.current.colors, ...colors },
    }
    this.emit('change', this.current)
  }

  // 使用主题色格式化文本
  styled(text: string, colorName: keyof ThemeColors): string {
    const color = this.current.colors[colorName]
    return style(text, color)
  }
}

// 工厂函数
export function createThemeManager(theme?: ThemeConfig): ThemeManager {
  return new ThemeManager(theme)
}
