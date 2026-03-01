// 工具调用卡片组件
import { wrapText, truncateToWidth } from '@vitamin/tui'
import type { Component } from '@vitamin/tui'

export interface ToolCardConfig {
  toolName: string
  args: Record<string, unknown>
  result?: string
  status: 'pending' | 'running' | 'done' | 'error'
  duration?: number
}

// 状态图标
const STATUS_ICONS: Record<string, string> = {
  pending: '\x1b[33m⏳\x1b[0m',
  running: '\x1b[36m⟳\x1b[0m',
  done: '\x1b[32m✓\x1b[0m',
  error: '\x1b[31m✗\x1b[0m',
}

export class ToolCard implements Component {
  private config: ToolCardConfig

  constructor(config: ToolCardConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const lines: string[] = []
    const icon = STATUS_ICONS[this.config.status] ?? STATUS_ICONS['pending']
    const durationStr = this.config.duration
      ? `\x1b[2m (${this.config.duration}ms)\x1b[0m`
      : ''

    // 工具头部
    lines.push(`  ${icon} \x1b[1m${this.config.toolName}\x1b[0m${durationStr}`)

    // 参数（截断显示）
    const argsStr = JSON.stringify(this.config.args)
    if (argsStr.length > width - 6) {
      lines.push(`    \x1b[2m${truncateToWidth(argsStr, width - 6)}\x1b[0m`)
    } else {
      lines.push(`    \x1b[2m${argsStr}\x1b[0m`)
    }

    // 结果（如有）
    if (this.config.result) {
      const resultLines = wrapText(this.config.result, width - 6)
      const maxLines = 3
      for (let i = 0; i < Math.min(resultLines.length, maxLines); i++) {
        lines.push(`    ${resultLines[i]}`)
      }
      if (resultLines.length > maxLines) {
        lines.push(`    \x1b[2m... (${resultLines.length - maxLines} more lines)\x1b[0m`)
      }
    }

    lines.push('')
    return lines
  }
}

export function createToolCard(config: ToolCardConfig): ToolCard {
  return new ToolCard(config)
}
