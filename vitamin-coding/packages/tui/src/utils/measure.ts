// 字符宽度测量 — CJK 双宽度字符处理（§S11.2）

// ANSI 转义序列正则
const ANSI_REGEX = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07/g

// 去除 ANSI 转义序列
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '')
}

// 判断 Unicode 代码点是否为全角字符（CJK 区域）
export function isFullWidth(codePoint: number): boolean {
  // CJK 统一表意文字
  if (codePoint >= 0x4e00 && codePoint <= 0x9fff) return true
  // CJK 兼容表意文字
  if (codePoint >= 0xf900 && codePoint <= 0xfaff) return true
  // CJK 扩展 A
  if (codePoint >= 0x3400 && codePoint <= 0x4dbf) return true
  // CJK 扩展 B-I (Supplementary)
  if (codePoint >= 0x20000 && codePoint <= 0x323af) return true
  // 全角拉丁/全角片假名
  if (codePoint >= 0xff01 && codePoint <= 0xff60) return true
  if (codePoint >= 0xffe0 && codePoint <= 0xffe6) return true
  // 平假名
  if (codePoint >= 0x3040 && codePoint <= 0x309f) return true
  // 片假名
  if (codePoint >= 0x30a0 && codePoint <= 0x30ff) return true
  // 韩文音节
  if (codePoint >= 0xac00 && codePoint <= 0xd7af) return true
  // CJK 标点符号
  if (codePoint >= 0x3000 && codePoint <= 0x303f) return true
  return false
}

// 测量字符串在终端中的显示宽度
export function measureWidth(text: string): number {
  const stripped = stripAnsi(text)
  let width = 0

  for (const char of stripped) {
    const codePoint = char.codePointAt(0)
    if (codePoint === undefined) continue

    if (isFullWidth(codePoint)) {
      width += 2
    } else {
      width += 1
    }
  }

  return width
}

// 截断字符串到指定终端宽度
export function truncateToWidth(text: string, maxWidth: number, ellipsis = '…'): string {
  const stripped = stripAnsi(text)
  let width = 0
  let result = ''
  const ellipsisWidth = measureWidth(ellipsis)

  for (const char of stripped) {
    const codePoint = char.codePointAt(0)
    if (codePoint === undefined) continue

    const charWidth = isFullWidth(codePoint) ? 2 : 1

    if (width + charWidth > maxWidth - ellipsisWidth) {
      return result + ellipsis
    }

    width += charWidth
    result += char
  }

  return result
}

// 用空格填充字符串到指定宽度
export function padToWidth(text: string, targetWidth: number): string {
  const currentWidth = measureWidth(text)
  if (currentWidth >= targetWidth) return text
  return text + ' '.repeat(targetWidth - currentWidth)
}

// 自动折行（按终端宽度）
export function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let currentLine = ''
  let currentWidth = 0

  for (const char of text) {
    if (char === '\n') {
      lines.push(currentLine)
      currentLine = ''
      currentWidth = 0
      continue
    }

    const codePoint = char.codePointAt(0)
    if (codePoint === undefined) continue

    const charWidth = isFullWidth(codePoint) ? 2 : 1

    if (currentWidth + charWidth > maxWidth) {
      lines.push(currentLine)
      currentLine = char
      currentWidth = charWidth
    } else {
      currentLine += char
      currentWidth += charWidth
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  return lines
}
