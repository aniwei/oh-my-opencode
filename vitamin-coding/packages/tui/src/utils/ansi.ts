// ANSI 颜色和样式工具

// 基本颜色码
export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
  strikethrough: '\x1b[9m',

  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // 亮色前景
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // 背景色
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const

// 256 色
export function color256(n: number): string {
  return `\x1b[38;5;${String(n)}m`
}

export function bgColor256(n: number): string {
  return `\x1b[48;5;${String(n)}m`
}

// RGB 真彩色
export function colorRgb(r: number, g: number, b: number): string {
  return `\x1b[38;2;${String(r)};${String(g)};${String(b)}m`
}

export function bgColorRgb(r: number, g: number, b: number): string {
  return `\x1b[48;2;${String(r)};${String(g)};${String(b)}m`
}

// 样式组合
export function style(text: string, ...codes: string[]): string {
  if (codes.length === 0) return text
  return codes.join('') + text + COLORS.reset
}

// CSI 2026 同步输出（消除闪烁）
export const SYNC_START = '\x1b[?2026h'
export const SYNC_END = '\x1b[?2026l'

// 光标操作
export function moveCursor(row: number, col: number): string {
  return `\x1b[${String(row)};${String(col)}H`
}

export function moveUp(n: number): string {
  return `\x1b[${String(n)}A`
}

export function moveDown(n: number): string {
  return `\x1b[${String(n)}B`
}

export function clearLine(): string {
  return '\x1b[2K'
}

export function clearScreen(): string {
  return '\x1b[2J'
}

export function hideCursor(): string {
  return '\x1b[?25l'
}

export function showCursor(): string {
  return '\x1b[?25h'
}
