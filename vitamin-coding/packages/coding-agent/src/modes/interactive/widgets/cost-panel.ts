// 费用面板组件 — 显示 token 用量和成本
import type { Component } from '@vitamin/tui'

export interface CostPanelConfig {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  totalCost: number
  currentMessageCost?: number
}

export class CostPanel implements Component {
  private config: CostPanelConfig

  constructor(config: CostPanelConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const lines: string[] = []

    lines.push('\x1b[1m Cost & Usage \x1b[0m')
    lines.push('─'.repeat(Math.min(width, 40)))

    // Token 用量
    const totalTokens = this.config.inputTokens + this.config.outputTokens
    lines.push(`  Input Tokens:   ${this.config.inputTokens.toLocaleString()}`)
    lines.push(`  Output Tokens:  ${this.config.outputTokens.toLocaleString()}`)

    if (this.config.cacheReadTokens) {
      lines.push(`  Cache Read:     ${this.config.cacheReadTokens.toLocaleString()}`)
    }
    if (this.config.cacheWriteTokens) {
      lines.push(`  Cache Write:    ${this.config.cacheWriteTokens.toLocaleString()}`)
    }

    lines.push(`  Total Tokens:   ${totalTokens.toLocaleString()}`)
    lines.push('')

    // 费用
    lines.push(`  Total Cost:     $${this.config.totalCost.toFixed(4)}`)
    if (this.config.currentMessageCost !== undefined) {
      lines.push(`  Last Message:   $${this.config.currentMessageCost.toFixed(4)}`)
    }

    lines.push('─'.repeat(Math.min(width, 40)))

    return lines
  }

  update(config: Partial<CostPanelConfig>): void {
    Object.assign(this.config, config)
  }
}

export function createCostPanel(config: CostPanelConfig): CostPanel {
  return new CostPanel(config)
}
