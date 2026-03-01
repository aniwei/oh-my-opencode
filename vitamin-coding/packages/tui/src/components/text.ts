// 多行文本组件 + 自动折行
import { wrapText } from '../utils/measure'

import type { Component } from '../renderer'

// 文本组件配置
export interface TextConfig {
  text: string
  wrap?: boolean
}

// 多行文本组件
export class TextComponent implements Component {
  private config: TextConfig

  constructor(config: TextConfig) {
    this.config = config
  }

  render(width: number): string[] {
    if (this.config.wrap !== false) {
      return wrapText(this.config.text, width)
    }
    return this.config.text.split('\n')
  }

  setText(text: string): void {
    this.config.text = text
  }

  getText(): string {
    return this.config.text
  }
}

// 工厂函数
export function createTextComponent(config: TextConfig): TextComponent {
  return new TextComponent(config)
}
