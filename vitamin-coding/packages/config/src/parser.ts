// JSONC 解析器，支持部分错误容忍
// 如果完整解析失败，尝试独立解析每个顶层键
import { createLogger, parseJsonc } from '@vitamin/shared'
import type { ConfigWarning, VitaminConfig } from './types'

const log = createLogger('config:parser')

// 解析 JSONC 配置字符串，容忍部分错误
// 完整解析失败时尝试按键恢复
export function parseConfigPartially(raw: string): {
  config: Partial<VitaminConfig>
  warnings: ConfigWarning[]
} {
  const warnings: ConfigWarning[] = []

  try {
    const parsed = parseJsonc<Partial<VitaminConfig>>(raw)
    return { config: parsed, warnings }
  } catch (error) {
    // 完整解析失败 —— 进入按键恢复模式
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    log.debug({ error: message }, 'Full JSONC parse failed, attempting key-by-key recovery')
  }

  return parseKeyByKey(raw, warnings)
}

// 尝试独立解析每个顶层键
// 将每个键的值包裹在花括号中单独解析
function parseKeyByKey(
  raw: string,
  warnings: ConfigWarning[],
): { config: Partial<VitaminConfig>; warnings: ConfigWarning[] } {
  const config: Record<string, unknown> = {}
  const lines = raw.split('\n')

  // 在零缩进处查找匹配 "key": 模式的行来确定顶层键边界
  const keyRanges = findTopLevelKeyRanges(lines)

  for (const range of keyRanges) {
    const keyLines = lines.slice(range.startLine, range.endLine + 1)
    const fragment = `{${keyLines.join('\n')}}`

    try {
      const parsed = parseJsonc<Record<string, unknown>>(fragment)
      for (const [key, value] of Object.entries(parsed)) {
        config[key] = value
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Parse error'
      // startLine 是 0-based 索引，转换为 1-based 行号
      // column 取该键声明行中引号的位置
      const keyLine = lines[range.startLine] ?? ''
      const columnOffset = keyLine.indexOf(`"${range.key}"`) + 1
      warnings.push({
        key: range.key,
        message,
        line: range.startLine + 1,
        column: columnOffset > 0 ? columnOffset : 1,
      })
    }
  }

  return { config: config as Partial<VitaminConfig>, warnings }
}

interface KeyRange {
  key: string
  startLine: number
  endLine: number
}

// 识别原始 JSONC 内容中的顶层键范围
function findTopLevelKeyRanges(lines: string[]): KeyRange[] {
  const ranges: KeyRange[] = []
  const keyPattern = /^\s*"(\w+)"\s*:/

  let currentKey: string | undefined
  let currentStart = 0

  for (let i = 0; i < lines.length; i++) {
    const match = keyPattern.exec(lines[i] ?? '')
    if (match) {
      if (currentKey !== undefined) {
        // 前一个键的结束：当前匹配行的前一行
        ranges.push({
          key: currentKey,
          startLine: currentStart,
          endLine: i - 1,
        })
      }
      currentKey = match[1]
      currentStart = i
    }
  }

  if (currentKey !== undefined) {
    // 最后一个键延伸到末尾（减去闭合花括号）
    const lastContent = findLastContentLine(lines)
    ranges.push({
      key: currentKey,
      startLine: currentStart,
      endLine: lastContent,
    })
  }

  return ranges
}

// 找到最后一个非空、非闭合花括号的行
function findLastContentLine(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = (lines[i] ?? '').trim()
    if (trimmed !== '' && trimmed !== '}') {
      return i
    }
  }
  return lines.length - 1
}

// 将字符偏移量转换为文本中的位置（行、列）
export function offsetToPosition(text: string, offset: number): { line: number; column: number } {
  let line = 1
  let column = 1
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}
