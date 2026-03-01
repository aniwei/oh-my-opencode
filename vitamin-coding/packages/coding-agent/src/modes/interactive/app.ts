// TUI 交互应用主入口（§S12 Week 13）
import { createLogger } from '@vitamin/shared'
import {
  createTerminal,
  createRenderer,
  parseKey,
  hideCursor,
  showCursor,
  clearScreen,
} from '@vitamin/tui'

import { ConversationPage } from './pages/conversation-page'
import { SessionListPage } from './pages/session-list-page'
import { SettingsPage } from './pages/settings-page'
import { createKeyBindings } from '../../core/keybindings'

import type { AgentSession, CLIOptions, ModeRunner } from '../../types'

const logger = createLogger('coding-agent:interactive')

// 页面类型
export type PageName = 'conversation' | 'sessions' | 'settings'

// 交互式 App 状态
export interface InteractiveAppState {
  currentPage: PageName
  isRunning: boolean
  inputText: string
  isAgentThinking: boolean
}

// 创建交互模式
export function createInteractiveMode(): ModeRunner {
  return {
    async run(session: AgentSession, options: CLIOptions): Promise<void> {
      const app = new InteractiveApp(session, options)
      await app.start()
    },
  }
}

// 交互式 TUI 应用
export class InteractiveApp {
  private readonly session: AgentSession
  private readonly terminal = createTerminal()
  private readonly renderer: ReturnType<typeof createRenderer>
  private readonly state: InteractiveAppState
  private readonly conversationPage: ConversationPage
  private readonly sessionListPage: SessionListPage
  private readonly settingsPage: SettingsPage

  constructor(session: AgentSession, _options: CLIOptions) {
    this.session = session

    const size = this.terminal.getSize()
    this.renderer = createRenderer({
      width: size.cols,
      height: size.rows,
      output: (data) => this.terminal.write(data),
    })

    this.state = {
      currentPage: 'conversation',
      isRunning: true,
      inputText: '',
      isAgentThinking: false,
    }

    this.conversationPage = new ConversationPage(session, this.renderer, size.cols)
    this.sessionListPage = new SessionListPage(session, this.renderer, size.cols)
    this.settingsPage = new SettingsPage(session, this.renderer, size.cols)

    this.setupKeyBindings()
  }

  // 启动 TUI
  async start(): Promise<void> {
    logger.info('Starting interactive TUI mode')

    this.terminal.enableRawMode()
    this.terminal.write(hideCursor())
    this.terminal.write(clearScreen())

    // 监听终端输入
    this.terminal.on('data', (data) => {
      this.handleInput(data)
    })

    // 监听终端resize
    this.terminal.on('resize', (cols, rows) => {
      this.renderer.resize(cols, rows)
      this.renderCurrentPage()
    })

    // 初始渲染
    this.renderCurrentPage()

    // 阻塞等待退出
    await this.waitForExit()
  }

  // 设置键盘绑定
  private setupKeyBindings(): void {
    const keyBindings = createKeyBindings()

    keyBindings.register('ctrl+c', async () => {
      if (this.state.isAgentThinking) {
        this.session.abort()
        this.state.isAgentThinking = false
        this.renderCurrentPage()
      } else {
        this.state.isRunning = false
      }
    })

    keyBindings.register('ctrl+d', async () => {
      this.state.isRunning = false
    })

    keyBindings.register('ctrl+l', async () => {
      this.terminal.write(clearScreen())
      this.renderCurrentPage()
    })

    keyBindings.register('tab', async () => {
      // 在页面之间切换
      const pages: PageName[] = ['conversation', 'sessions', 'settings']
      const currentIndex = pages.indexOf(this.state.currentPage)
      this.state.currentPage = pages[(currentIndex + 1) % pages.length] as PageName
      this.renderCurrentPage()
    })
  }

  // 处理输入
  private handleInput(data: string): void {
    const key = parseKey(data)

    if (key.ctrl && key.name === 'c') {
      if (this.state.isAgentThinking) {
        this.session.abort()
        this.state.isAgentThinking = false
      } else {
        this.state.isRunning = false
      }
      return
    }

    // 交给当前页面处理
    const currentPage = this.getCurrentPage()
    currentPage.handleInput(key)
    this.renderCurrentPage()
  }

  // 获取当前页面
  private getCurrentPage(): ConversationPage | SessionListPage | SettingsPage {
    switch (this.state.currentPage) {
      case 'conversation':
        return this.conversationPage
      case 'sessions':
        return this.sessionListPage
      case 'settings':
        return this.settingsPage
    }
  }

  // 渲染当前页面
  private renderCurrentPage(): void {
    const page = this.getCurrentPage()
    const lines = page.render()
    this.renderer.renderFrame(lines)
  }

  // 等待退出
  private waitForExit(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.state.isRunning) {
          clearInterval(checkInterval)
          this.cleanup()
          resolve()
        }
      }, 100)
    })
  }

  // 清理资源
  private cleanup(): void {
    this.terminal.write(showCursor())
    this.terminal.write(clearScreen())
    this.terminal.disableRawMode()
    logger.info('Interactive TUI stopped')
  }
}
