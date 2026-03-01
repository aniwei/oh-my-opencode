// 对话页面 — TUI 主对话界面
import {
  createMessageDisplayComponent,
  createEditorComponent,
  createLoaderComponent,
  createBoxComponent,
} from '@vitamin/tui'
import type { Component, ParsedKey } from '@vitamin/tui'

import type { AgentSession } from '../../../types'

// 对话消息
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// 对话页面
export class ConversationPage {
  private readonly session: AgentSession
  private readonly renderer: { renderFrame(lines: string[]): string }
  private width: number
  private messages: ConversationMessage[] = []
  private inputBuffer = ''
  private isThinking = false
  private scrollOffset = 0

  constructor(
    session: AgentSession,
    renderer: { renderFrame(lines: string[]): string },
    width: number,
  ) {
    this.session = session
    this.renderer = renderer
    this.width = width
  }

  // 处理按键输入
  handleInput(key: ParsedKey): void {
    if (key.name === 'return' && !key.shift) {
      this.submitInput()
      return
    }

    if (key.name === 'backspace') {
      this.inputBuffer = this.inputBuffer.slice(0, -1)
      return
    }

    if (key.name === 'up') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      return
    }

    if (key.name === 'down') {
      this.scrollOffset = Math.min(this.messages.length, this.scrollOffset + 1)
      return
    }

    // 可打印字符
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      this.inputBuffer += key.sequence
    }
  }

  // 提交输入
  private submitInput(): void {
    const text = this.inputBuffer.trim()
    if (!text || this.isThinking) return

    this.inputBuffer = ''
    this.messages.push({
      role: 'user',
      content: text,
      timestamp: new Date(),
    })

    this.isThinking = true

    // 异步执行 Agent 调用
    this.session.prompt(text).then(
      (result) => {
        this.messages.push({
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
        })
        this.isThinking = false
        this.renderer.renderFrame(this.render())
      },
      (error) => {
        this.messages.push({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        })
        this.isThinking = false
        this.renderer.renderFrame(this.render())
      },
    )
  }

  // 渲染页面
  render(): string[] {
    const lines: string[] = []

    // 标题栏
    const titleBar = `\x1b[7m vitamin \x1b[0m  Model: ${this.session.state.currentModel}  Messages: ${this.session.state.messageCount}`
    lines.push(titleBar)
    lines.push('─'.repeat(this.width))

    // 消息区域
    const messageDisplay = createMessageDisplayComponent({
      messages: this.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      maxContentLines: 30,
    })
    lines.push(...messageDisplay.render(this.width))

    // 思考指示器
    if (this.isThinking) {
      const loader = createLoaderComponent({ text: 'Thinking...' })
      lines.push(...loader.render(this.width))
    }

    // 分隔线
    lines.push('─'.repeat(this.width))

    // 输入区域
    const prompt = '> '
    const cursor = this.isThinking ? '' : '\u2588'
    lines.push(`${prompt}${this.inputBuffer}${cursor}`)

    // 状态栏
    const cost = `Cost: $${this.session.state.totalCost.toFixed(4)}`
    const tokens = `Tokens: ${this.session.state.totalTokens.input + this.session.state.totalTokens.output}`
    const statusLine = `\x1b[7m ${cost}  ${tokens} \x1b[0m`
    lines.push(statusLine)

    return lines
  }

  resize(width: number): void {
    this.width = width
  }
}
