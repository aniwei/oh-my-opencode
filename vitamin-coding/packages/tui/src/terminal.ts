// 终端抽象（TTY I/O + 尺寸监听 + 原始模式）
import { TypedEventEmitter } from '@vitamin/shared'

import type { EventMap } from '@vitamin/shared'

// 终端事件
interface TerminalEvents extends EventMap {
  data: (data: string) => void
  resize: (cols: number, rows: number) => void
  close: () => void
}

// 终端配置
export interface TerminalConfig {
  stdin?: NodeJS.ReadStream
  stdout?: NodeJS.WriteStream
  stderr?: NodeJS.WriteStream
}

// 终端抽象
export class Terminal extends TypedEventEmitter<TerminalEvents> {
  private readonly stdin: NodeJS.ReadStream
  private readonly stdout: NodeJS.WriteStream
  private rawMode = false

  constructor(config: TerminalConfig = {}) {
    super()
    this.stdin = config.stdin ?? process.stdin
    this.stdout = config.stdout ?? process.stdout
  }

  // 获取终端尺寸
  getSize(): { cols: number; rows: number } {
    return {
      cols: this.stdout.columns ?? 80,
      rows: this.stdout.rows ?? 24,
    }
  }

  // 写入终端
  write(data: string): void {
    this.stdout.write(data)
  }

  // 启用原始模式（接收按键事件）
  enableRawMode(): void {
    if (this.stdin.isTTY && !this.rawMode) {
      this.stdin.setRawMode(true)
      this.rawMode = true
    }
  }

  // 禁用原始模式
  disableRawMode(): void {
    if (this.stdin.isTTY && this.rawMode) {
      this.stdin.setRawMode(false)
      this.rawMode = false
    }
  }

  // 开始监听输入
  startListening(): void {
    this.stdin.setEncoding('utf-8')
    this.stdin.on('data', (data: string) => {
      this.emit('data', data)
    })

    // 监听终端尺寸变化
    this.stdout.on('resize', () => {
      const { cols, rows } = this.getSize()
      this.emit('resize', cols, rows)
    })
  }

  // 停止监听
  stopListening(): void {
    this.stdin.removeAllListeners('data')
    this.stdout.removeAllListeners('resize')
    this.disableRawMode()
  }

  // 是否为 TTY
  isTTY(): boolean {
    return Boolean(this.stdin.isTTY && this.stdout.isTTY)
  }
}

// 工厂函数
export function createTerminal(config?: TerminalConfig): Terminal {
  return new Terminal(config)
}
