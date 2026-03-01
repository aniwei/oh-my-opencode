// 状态栏组件 — 底部状态信息
import { padToWidth, truncateToWidth } from '@vitamin/tui'
import type { Component } from '@vitamin/tui'

export interface StatusBarConfig {
  model: string
  mode: string
  sessionId: string
  isConnected: boolean
  extraInfo?: string
}

export class StatusBar implements Component {
  private config: StatusBarConfig

  constructor(config: StatusBarConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const left = ` ${this.config.model}  │  ${this.config.mode}`
    const connectionIcon = this.config.isConnected ? '\x1b[32m●\x1b[0m' : '\x1b[31m●\x1b[0m'
    const right = `${connectionIcon}  ${truncateToWidth(this.config.sessionId, 8)} `

    const extra = this.config.extraInfo ? `  │  ${this.config.extraInfo}` : ''
    const content = `${left}${extra}`

    // 计算填充
    const paddingLen = Math.max(0, width - content.length - right.length - 2)
    const padding = ' '.repeat(paddingLen)

    return [
      `\x1b[7m${content}${padding}${right}\x1b[0m`,
    ]
  }

  update(config: Partial<StatusBarConfig>): void {
    Object.assign(this.config, config)
  }
}

export function createStatusBar(config: StatusBarConfig): StatusBar {
  return new StatusBar(config)
}
