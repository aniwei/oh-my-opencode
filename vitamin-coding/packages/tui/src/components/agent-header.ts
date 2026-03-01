// Agent 头部渲染组件 — 显示当前 Agent 信息 (§S11.3)
import { padToWidth, truncateToWidth } from '../utils/measure'
import { style, COLORS } from '../utils/ansi'

import type { Component } from '../renderer'

export interface AgentHeaderConfig {
  agentName: string
  model: string
  category?: string
  isRunning: boolean
  tokenUsage?: { input: number; output: number }
}

export class AgentHeaderComponent implements Component {
  private config: AgentHeaderConfig

  constructor(config: AgentHeaderConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const lines: string[] = []

    // 状态指示器
    const statusIcon = this.config.isRunning
      ? style('●', COLORS.green)
      : style('○', COLORS.gray)

    // Agent 名称 + 模型
    const nameDisplay = style(this.config.agentName, COLORS.yellow)
    const modelDisplay = style(this.config.model, COLORS.cyan)
    const categoryDisplay = this.config.category
      ? ` ${style(`[${this.config.category}]`, COLORS.gray)}`
      : ''

    const headerLine = `${statusIcon} ${nameDisplay} ${modelDisplay}${categoryDisplay}`
    lines.push(truncateToWidth(headerLine, width))

    // Token 使用量
    if (this.config.tokenUsage) {
      const { input, output } = this.config.tokenUsage
      const total = input + output
      const usage = style(
        `tokens: ${formatTokenCount(input)}↓ ${formatTokenCount(output)}↑ (${formatTokenCount(total)} total)`,
        COLORS.gray,
      )
      lines.push(`  ${usage}`)
    }

    // 分隔线
    lines.push(padToWidth('─'.repeat(width), width))

    return lines
  }

  setRunning(isRunning: boolean): void {
    this.config.isRunning = isRunning
  }

  setTokenUsage(usage: { input: number; output: number }): void {
    this.config.tokenUsage = usage
  }
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`
  }
  return String(count)
}

export function createAgentHeaderComponent(config: AgentHeaderConfig): AgentHeaderComponent {
  return new AgentHeaderComponent(config)
}
