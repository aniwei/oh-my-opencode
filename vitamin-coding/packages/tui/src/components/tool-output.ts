// 工具输出渲染组件 — 渲染工具调用结果 (§S11.3)
import { truncateToWidth, wrapText } from '../utils/measure'
import { style, COLORS } from '../utils/ansi'

import type { Component } from '../renderer'

export interface ToolOutputConfig {
  toolName: string
  args?: Record<string, unknown>
  result: string
  error?: string
  durationMs?: number
  maxResultLines?: number
}

export class ToolOutputComponent implements Component {
  private config: ToolOutputConfig

  constructor(config: ToolOutputConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const lines: string[] = []
    const maxLines = this.config.maxResultLines ?? 20

    // 工具名 + 耗时
    const header = this.config.durationMs !== undefined
      ? `${style(this.config.toolName, COLORS.cyan)} ${style(`(${this.config.durationMs}ms)`, COLORS.gray)}`
      : style(this.config.toolName, COLORS.cyan)
    lines.push(`  ${style('⚙', COLORS.blue)} ${header}`)

    // 参数摘要（简化显示）
    if (this.config.args) {
      const argsStr = Object.entries(this.config.args)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ')
      const truncated = truncateToWidth(argsStr, width - 6)
      lines.push(`    ${style(truncated, COLORS.gray)}`)
    }

    // 错误或结果
    if (this.config.error) {
      lines.push(`    ${style('ERROR:', COLORS.red)} ${this.config.error}`)
    } else {
      const resultLines = wrapText(this.config.result, width - 4)
      const displayLines = resultLines.slice(0, maxLines)
      for (const line of displayLines) {
        lines.push(`    ${line}`)
      }
      if (resultLines.length > maxLines) {
        lines.push(`    ${style(`... (${resultLines.length - maxLines} more lines)`, COLORS.gray)}`)
      }
    }

    return lines
  }

  setResult(result: string): void {
    this.config.result = result
  }
}

export function createToolOutputComponent(config: ToolOutputConfig): ToolOutputComponent {
  return new ToolOutputComponent(config)
}
