// 对话页面 — TUI 主对话界面
import { renderPageShell } from './page-shell'

import type { AgentSession } from '../../../types'

type ParsedKey = {
  name?: string
  raw: string
  shift?: boolean
}

const COLORS = {
  gray: '\x1b[90m',
  brightCyan: '\x1b[96m',
  white: '\x1b[97m',
  inverse: '\x1b[7m',
  reset: '\x1b[0m',
}

const SQUARE_BORDER = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
}

type LocalComponent = {
  render: (width: number) => string[]
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, '')
}

function measureWidth(input: string): number {
  return stripAnsi(input).length
}

function truncateToWidth(input: string, width: number, suffix = ''): string {
  if (width <= 0) return ''
  const clean = stripAnsi(input)
  if (clean.length <= width) return input
  return clean.slice(0, Math.max(0, width - suffix.length)) + suffix
}

function padToWidth(input: string, width: number): string {
  const current = measureWidth(input)
  if (current >= width) return input
  return input + ' '.repeat(width - current)
}

function style(input: string, ...styles: string[]): string {
  if (styles.length === 0) return input
  return `${styles.join('')}${input}${COLORS.reset}`
}

function bgColor256(color: number): string {
  return `\x1b[48;5;${String(color)}m`
}

function isPrintable(key: ParsedKey): boolean {
  return key.raw.length > 0 && !key.name
}

function wrapText(input: string, width: number): string[] {
  if (width <= 1) return [input]
  const words = input.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!word) continue
    const candidate = current ? `${current} ${word}` : word
    if (measureWidth(candidate) <= width) {
      current = candidate
      continue
    }
    if (current) {
      lines.push(current)
      current = word
      continue
    }
    lines.push(truncateToWidth(word, width))
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

class InputComponent implements LocalComponent {
  private value = ''
  private cursorPos = 0

  constructor(
    private readonly prompt: string,
    private readonly placeholder: string,
  ) {}

  render(_width: number): string[] {
    const display = this.value || style(this.placeholder, COLORS.gray)
    return [`${this.prompt}${display}`]
  }

  insert(text: string): void {
    this.value = this.value.slice(0, this.cursorPos) + text + this.value.slice(this.cursorPos)
    this.cursorPos += text.length
  }

  backspace(): void {
    if (this.cursorPos <= 0) return
    this.value = this.value.slice(0, this.cursorPos - 1) + this.value.slice(this.cursorPos)
    this.cursorPos--
  }

  delete(): void {
    if (this.cursorPos >= this.value.length) return
    this.value = this.value.slice(0, this.cursorPos) + this.value.slice(this.cursorPos + 1)
  }

  moveLeft(): void {
    if (this.cursorPos > 0) this.cursorPos--
  }

  moveRight(): void {
    if (this.cursorPos < this.value.length) this.cursorPos++
  }

  moveHome(): void {
    this.cursorPos = 0
  }

  moveEnd(): void {
    this.cursorPos = this.value.length
  }

  submit(): string {
    const text = this.value
    this.value = ''
    this.cursorPos = 0
    return text
  }

  getValue(): string {
    return this.value
  }
}

function createInputComponent(config: { prompt?: string; placeholder?: string }): InputComponent {
  return new InputComponent(config.prompt ?? '> ', config.placeholder ?? '')
}

class TextComponent implements LocalComponent {
  constructor(private readonly text: string, private readonly wrap: boolean) {}

  render(width: number): string[] {
    if (!this.wrap) return [this.text]
    return wrapText(this.text, Math.max(1, width))
  }
}

function createTextComponent(config: { text: string; wrap?: boolean }): TextComponent {
  return new TextComponent(config.text, config.wrap !== false)
}

class BoxComponent implements LocalComponent {
  private readonly children: LocalComponent[] = []

  constructor(
    private readonly title: string,
    private readonly width: number,
  ) {}

  addChild(child: LocalComponent): void {
    this.children.push(child)
  }

  render(width: number): string[] {
    const w = Math.max(12, Math.min(this.width, width))
    const inner = Math.max(1, w - 2)
    const lines: string[] = []
    const title = this.title ? ` ${this.title} ` : ''
    const top = SQUARE_BORDER.topLeft + title + SQUARE_BORDER.horizontal.repeat(Math.max(0, inner - title.length)) + SQUARE_BORDER.topRight
    lines.push(top)
    for (const child of this.children) {
      for (const line of child.render(inner)) {
        lines.push(SQUARE_BORDER.vertical + padToWidth(truncateToWidth(line, inner), inner) + SQUARE_BORDER.vertical)
      }
    }
    lines.push(SQUARE_BORDER.bottomLeft + SQUARE_BORDER.horizontal.repeat(inner) + SQUARE_BORDER.bottomRight)
    return lines
  }
}

function createBoxComponent(config: { title?: string; width?: number }): BoxComponent {
  return new BoxComponent(config.title ?? '', config.width ?? 60)
}

function createLoaderComponent(config: { text: string }): LocalComponent {
  return {
    render: () => [style(`⏳ ${config.text}`, COLORS.gray)],
  }
}

function createMessageDisplayComponent(config: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxContentLines: number
}): LocalComponent {
  return {
    render: (width) => {
      const lines: string[] = []
      for (const message of config.messages) {
        const prefix = message.role === 'user' ? style('You', COLORS.brightCyan) : style('Assistant', COLORS.white)
        lines.push(`${prefix}:`)
        lines.push(...wrapText(message.content, Math.max(8, width - 2)).map((line) => `  ${line}`))
      }
      return lines.slice(-Math.max(1, config.maxContentLines))
    },
  }
}

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
  private height: number
  private messages: ConversationMessage[] = []
  private readonly inputComponent = createInputComponent({
    prompt: '› ',
    placeholder: '输入消息…',
  })
  private isThinking = false
  private cursorVisible = true
  private scrollOffset = 0
  private sidebarMode: 'auto' | 'hidden' | 'visible' = 'auto'

  constructor(
    session: AgentSession,
    renderer: { renderFrame(lines: string[]): string },
    width: number,
    height = 24,
  ) {
    this.session = session
    this.renderer = renderer
    this.width = width
    this.height = height
  }

  // 处理按键输入
  handleInput(key: ParsedKey): void {
    if (key.name === 'enter' && !key.shift) {
      this.submitInput()
      return
    }

    if (key.name === 'backspace') {
      this.inputComponent.backspace()
      return
    }

    if (key.name === 'delete') {
      this.inputComponent.delete()
      return
    }

    if (key.name === 'left') {
      this.inputComponent.moveLeft()
      return
    }

    if (key.name === 'right') {
      this.inputComponent.moveRight()
      return
    }

    if (key.name === 'home') {
      this.inputComponent.moveHome()
      return
    }

    if (key.name === 'end') {
      this.inputComponent.moveEnd()
      return
    }

    if (key.name === 'up') {
      const maxOffset = this.getMaxScrollOffset()
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + 1)
      return
    }

    if (key.name === 'down') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      return
    }

    // 可打印字符
    if (isPrintable(key)) {
      this.inputComponent.insert(key.raw)
    }
  }

  // 提交输入
  private submitInput(): void {
    const text = this.inputComponent.submit().trim()
    if (!text || this.isThinking) return

    this.scrollOffset = 0
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
        this.scrollOffset = 0
        this.isThinking = false
        this.renderer.renderFrame(this.render())
      },
      (error) => {
        this.messages.push({
          role: 'assistant',
          content: `错误：${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        })
        this.scrollOffset = 0
        this.isThinking = false
        this.renderer.renderFrame(this.render())
      },
    )
  }

  private getVisibleMessageCount(): number {
    const reservedRows = this.isThinking ? 14 : 12
    const messageRowsBudget = Math.max(2, this.height - reservedRows)
    const averageRowsPerMessage = 2
    return Math.max(1, Math.floor(messageRowsBudget / averageRowsPerMessage))
  }

  private getMaxScrollOffset(): number {
    const visible = this.getVisibleMessageCount()
    return Math.max(0, this.messages.length - visible)
  }

  private getVisibleMessages(): ConversationMessage[] {
    const visible = this.getVisibleMessageCount()
    const maxOffset = this.getMaxScrollOffset()
    this.scrollOffset = Math.min(maxOffset, this.scrollOffset)

    const end = this.messages.length - this.scrollOffset
    const start = Math.max(0, end - visible)
    return this.messages.slice(start, end)
  }

  // 渲染页面
  render(): string[] {
    if (this.messages.length === 0 && !this.isThinking) {
      return this.renderEmptyHome()
    }

    const body: string[] = []

    // 消息区域
    const messageDisplay = createMessageDisplayComponent({
      messages: this.getVisibleMessages().map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      maxContentLines: Math.max(4, Math.min(16, this.height - 10)),
    })
    body.push(...messageDisplay.render(this.width))

    // 思考指示器
    if (this.isThinking) {
      const loader = createLoaderComponent({ text: '思考中...' })
      body.push(...loader.render(this.width))
    }

    // 输入区域
    const inputBox = createBoxComponent({
      title: this.isThinking ? 'Thinking' : 'Input',
      width: Math.max(20, Math.min(this.width, 92)),
    })
    const inputLine = this.inputComponent.render(Math.max(12, this.width - 10))[0] ?? ''
    inputBox.addChild(createTextComponent({ text: inputLine, wrap: false }))
    inputBox.addChild(createTextComponent({ text: 'Enter 发送  Shift+Enter 换行', wrap: false }))

    body.push('')
    body.push(...inputBox.render(this.width))

    // 状态栏
    const cost = `成本：$${this.session.state.totalCost.toFixed(4)}`
    const tokens = `Token：${String(this.session.state.totalTokens.input + this.session.state.totalTokens.output)}`
    const scrollState = this.scrollOffset > 0 ? `  scroll ↑${String(this.scrollOffset)}` : ''
    const statusLine = `status ${cost}  ${tokens}${scrollState}`
    const sidebar = this.isSidebarVisible()
      ? {
          title: 'Context',
          lines: [
            `session ${this.session.id.slice(0, 8)}`,
            `model ${this.session.state.currentModel}`,
            `messages ${String(this.messages.length)}`,
            `cost ${this.session.state.totalCost.toFixed(4)}`,
            `tokens ${String(this.session.state.totalTokens.input + this.session.state.totalTokens.output)}`,
            '',
            'Tab 切页',
            'Ctrl+B 侧栏',
            'Ctrl+C 中断',
            'Ctrl+D 退出',
          ],
        }
      : undefined

    return renderPageShell({
      title: 'Session',
      width: this.width,
      height: this.height,
      bodyMaxWidth: 92,
      bodyCenter: true,
      meta: [
        `${style(`model ${this.session.state.currentModel}`, COLORS.brightCyan)}  ${style(`messages ${String(this.messages.length)}`, COLORS.gray)}`,
      ],
      body,
      bodyAlign: 'end',
      sidebar,
      statusLine,
      hints: ['Tab 切换页面  Ctrl+B 侧栏  Ctrl+C 中断  Ctrl+D 退出'],
    })
  }

  private renderEmptyHome(): string[] {
    const safeWidth = Math.max(1, this.width - 1)
    const lines = Array.from({ length: this.height }, () => '')
    const center = (row: number, text: string): void => {
      if (row < 0 || row >= lines.length) return
      const contentWidth = measureWidth(text)
      const leftPadding = Math.max(0, Math.floor((safeWidth - contentWidth) / 2))
      lines[row] = ' '.repeat(leftPadding) + text
    }

    const boxWidth = Math.max(44, Math.min(76, safeWidth - 16))
    const inputTop = Math.max(2, Math.floor(this.height * 0.45))
    const fitToBox = (text: string): string => measureWidth(text) > boxWidth 
      ? truncateToWidth(text, boxWidth) 
      : text
    const inputBg = bgColor256(236)
    const inputContentWidth = Math.max(16, boxWidth - 4)
    const placeholderText = 'Ask anything...'
    const inputValue = this.inputComponent.getValue()
    const displayText = inputValue.length > 0 ? inputValue : placeholderText
    const clippedContent = truncateToWidth(displayText, inputContentWidth, '')
    const paddedContent = padToWidth(clippedContent, inputContentWidth)

    let renderedContent: string
    if (inputValue.length === 0) {
      const placeholderChars = paddedContent
      if (this.cursorVisible && inputContentWidth > 0) {
        const cursorChar = placeholderChars[0] ?? ' '
        const rest = placeholderChars.slice(1)
        renderedContent = `${style(cursorChar, COLORS.inverse)}${style(rest, COLORS.gray)}`
      } else {
        renderedContent = style(placeholderChars, COLORS.gray)
      }
    } else {
      renderedContent = paddedContent
      if (this.cursorVisible && inputContentWidth > 0) {
        const cursorIndex = Math.min(measureWidth(clippedContent), inputContentWidth - 1)
        const before = paddedContent.slice(0, cursorIndex)
        const cursorChar = paddedContent[cursorIndex] ?? ' '
        const after = paddedContent.slice(cursorIndex + 1)
        renderedContent = `${before}${style(cursorChar, COLORS.inverse)}${after}`
      }
    }

    const topPaddingLine = style(
      `${style('|', COLORS.brightCyan)} ${' '.repeat(Math.max(0, inputContentWidth))}`,
      inputBg,
    )
    const inputLine = style(`${style('|', COLORS.brightCyan)} ${renderedContent}`, inputBg)
    const bottomPaddingLine = style(
      `${style('|', COLORS.brightCyan)} ${' '.repeat(Math.max(0, inputContentWidth))}`,
      inputBg,
    )

    center(inputTop, fitToBox(topPaddingLine))
    center(inputTop + 1, fitToBox(inputLine))
    center(inputTop + 2, fitToBox(bottomPaddingLine))

    const version = style('1.2.15', COLORS.gray)
    const versionRow = this.height - 1
    if (versionRow >= 0 && versionRow < lines.length) {
      const versionWidth = measureWidth(version)
      const left = Math.max(0, safeWidth - versionWidth)
      lines[versionRow] = padToWidth('', left) + version
    }

    return lines.map((line) => measureWidth(line) > safeWidth ? truncateToWidth(line, safeWidth) : line)
  }

  toggleSidebar(): void {
    this.sidebarMode = this.isSidebarVisible() ? 'hidden' : 'visible'
  }

  private isSidebarVisible(): boolean {
    if (this.sidebarMode === 'auto') {
      return this.width >= 110
    }
    return this.sidebarMode === 'visible'
  }

  resize(width: number, height?: number): void {
    this.width = width
    if (typeof height === 'number') {
      this.height = height
      this.scrollOffset = Math.min(this.scrollOffset, this.getMaxScrollOffset())
    }
  }

  setCursorVisible(visible: boolean): void {
    this.cursorVisible = visible
  }

  isThinkingActive(): boolean {
    return this.isThinking
  }
}
