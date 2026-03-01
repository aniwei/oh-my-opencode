// 布局盒子组件（border + padding）
import { measureWidth } from '../utils/measure'

import type { Component } from '../renderer'

// 盒子配置
export interface BoxConfig {
  border?: boolean
  borderStyle?: BorderStyle
  padding?: number
  title?: string
  width?: number
}

// 边框样式
export interface BorderStyle {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
  horizontal: string
  vertical: string
}

// 默认边框样式（圆角）
export const ROUNDED_BORDER: BorderStyle = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
}

// 直角边框
export const SQUARE_BORDER: BorderStyle = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
}

// 布局盒子
export class BoxComponent implements Component {
  private children: Component[] = []
  private readonly config: Required<BoxConfig>

  constructor(config: BoxConfig = {}) {
    this.config = {
      border: config.border ?? true,
      borderStyle: config.borderStyle ?? ROUNDED_BORDER,
      padding: config.padding ?? 0,
      title: config.title ?? '',
      width: config.width ?? 0,
    }
  }

  render(width: number): string[] {
    const boxWidth = this.config.width > 0 ? this.config.width : width
    const hasBorder = this.config.border
    const padding = this.config.padding
    const bs = this.config.borderStyle

    // 计算内部可用宽度
    const borderWidth = hasBorder ? 2 : 0
    const paddingWidth = padding * 2
    const innerWidth = Math.max(1, boxWidth - borderWidth - paddingWidth)

    // 收集子组件渲染
    const childLines: string[] = []
    for (const child of this.children) {
      childLines.push(...child.render(innerWidth))
    }

    // padding 空格
    const padStr = ' '.repeat(padding)

    const result: string[] = []

    // 上边框
    if (hasBorder) {
      const contentWidth = boxWidth - 2
      if (this.config.title.length > 0) {
        const title = ` ${this.config.title} `
        const titleLen = measureWidth(title)
        const remainLen = Math.max(0, contentWidth - titleLen)
        result.push(bs.topLeft + title + bs.horizontal.repeat(remainLen) + bs.topRight)
      } else {
        result.push(bs.topLeft + bs.horizontal.repeat(contentWidth) + bs.topRight)
      }
    }

    // padding 顶部行
    for (let p = 0; p < padding; p++) {
      const lineContent = ' '.repeat(innerWidth + paddingWidth)
      if (hasBorder) {
        result.push(bs.vertical + lineContent + bs.vertical)
      } else {
        result.push(lineContent)
      }
    }

    // 子内容行
    for (const line of childLines) {
      const lineWidth = measureWidth(line)
      const fillLen = Math.max(0, innerWidth - lineWidth)
      const paddedLine = padStr + line + ' '.repeat(fillLen) + padStr

      if (hasBorder) {
        result.push(bs.vertical + paddedLine + bs.vertical)
      } else {
        result.push(paddedLine)
      }
    }

    // padding 底部行
    for (let p = 0; p < padding; p++) {
      const lineContent = ' '.repeat(innerWidth + paddingWidth)
      if (hasBorder) {
        result.push(bs.vertical + lineContent + bs.vertical)
      } else {
        result.push(lineContent)
      }
    }

    // 下边框
    if (hasBorder) {
      const contentWidth = boxWidth - 2
      result.push(bs.bottomLeft + bs.horizontal.repeat(contentWidth) + bs.bottomRight)
    }

    return result
  }

  // 添加子组件
  addChild(child: Component): void {
    this.children.push(child)
  }

  // 移除所有子组件
  clearChildren(): void {
    this.children = []
  }

  // 获取子组件数量
  getChildCount(): number {
    return this.children.length
  }
}

// 工厂函数
export function createBoxComponent(config?: BoxConfig): BoxComponent {
  return new BoxComponent(config)
}
