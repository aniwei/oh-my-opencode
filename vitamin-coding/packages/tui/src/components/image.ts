// 内联图片组件（Kitty/iTerm2 协议）
import type { Component } from '../renderer'

// 图片协议
export type ImageProtocol = 'kitty' | 'iterm2' | 'sixel' | 'none'

// 图片配置
export interface ImageConfig {
  data: Buffer | string
  width?: number
  height?: number
  protocol?: ImageProtocol
}

// 检测终端图片支持
export function detectImageProtocol(): ImageProtocol {
  const term = process.env['TERM_PROGRAM'] ?? ''
  const termInfo = process.env['TERM'] ?? ''

  // iTerm2
  if (term === 'iTerm.app' || term === 'WezTerm') {
    return 'iterm2'
  }

  // Kitty
  if (term === 'kitty' || termInfo.includes('kitty')) {
    return 'kitty'
  }

  return 'none'
}

// 将 Buffer 转 base64
function toBase64(data: Buffer | string): string {
  if (typeof data === 'string') {
    return Buffer.from(data).toString('base64')
  }
  return data.toString('base64')
}

// Kitty 图片协议
function kittyImage(data: Buffer | string, width?: number, height?: number): string {
  const b64 = toBase64(data)
  const size = b64.length

  // Kitty 使用 APC 序列 (ESC _ ... ESC \)
  const widthParam = width !== undefined ? `,c=${String(width)}` : ''
  const heightParam = height !== undefined ? `,r=${String(height)}` : ''

  // 分块发送（每块 4096 字节）
  const chunkSize = 4096
  const chunks: string[] = []

  for (let i = 0; i < size; i += chunkSize) {
    const chunk = b64.slice(i, i + chunkSize)
    const isLast = i + chunkSize >= size
    const moreFlag = isLast ? 0 : 1

    if (i === 0) {
      chunks.push(`\x1b_Ga=T,f=100,m=${String(moreFlag)}${widthParam}${heightParam};${chunk}\x1b\\`)
    } else {
      chunks.push(`\x1b_Gm=${String(moreFlag)};${chunk}\x1b\\`)
    }
  }

  return chunks.join('')
}

// iTerm2 图片协议 (OSC 1337)
function iterm2Image(data: Buffer | string, width?: number, height?: number): string {
  const b64 = toBase64(data)
  const widthParam = width !== undefined ? `;width=${String(width)}` : ''
  const heightParam = height !== undefined ? `;height=${String(height)}` : ''

  return `\x1b]1337;File=inline=1${widthParam}${heightParam}:${b64}\x07`
}

// 内联图片组件
export class ImageComponent implements Component {
  private config: ImageConfig
  private cachedOutput: string | null = null

  constructor(config: ImageConfig) {
    this.config = {
      ...config,
      protocol: config.protocol ?? detectImageProtocol(),
    }
  }

  render(_width: number): string[] {
    if (this.config.protocol === 'none') {
      return ['[image: terminal does not support inline images]']
    }

    const output = this.getImageOutput()
    if (output.length === 0) {
      return ['[image: render failed]']
    }

    // 图片作为单行输出（终端协议处理换行）
    return [output]
  }

  private getImageOutput(): string {
    if (this.cachedOutput !== null) return this.cachedOutput

    try {
      let output: string
      switch (this.config.protocol) {
        case 'kitty':
          output = kittyImage(this.config.data, this.config.width, this.config.height)
          break
        case 'iterm2':
          output = iterm2Image(this.config.data, this.config.width, this.config.height)
          break
        default:
          output = ''
      }
      this.cachedOutput = output
      return output
    } catch {
      return ''
    }
  }

  // 更新图片数据
  setData(data: Buffer | string): void {
    this.config.data = data
    this.cachedOutput = null
  }

  // 获取协议
  getProtocol(): ImageProtocol {
    return this.config.protocol ?? 'none'
  }
}

// 工厂函数
export function createImageComponent(config: ImageConfig): ImageComponent {
  return new ImageComponent(config)
}
