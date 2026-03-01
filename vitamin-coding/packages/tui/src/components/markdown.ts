// Markdown 渲染组件 — 代码语法高亮（验收 4.1.4）
import { COLORS, style } from '../utils/ansi'

import type { Component } from '../renderer'

// Markdown 渲染配置
export interface MarkdownConfig {
  codeTheme?: CodeTheme
}

// 代码高亮主题
interface CodeTheme {
  keyword: string
  string: string
  number: string
  comment: string
  type: string
  function: string
  punctuation: string
}

// 默认代码高亮主题
const DEFAULT_CODE_THEME: CodeTheme = {
  keyword: COLORS.magenta,
  string: COLORS.green,
  number: COLORS.yellow,
  comment: COLORS.gray,
  type: COLORS.cyan,
  function: COLORS.blue,
  punctuation: COLORS.white,
}

// TypeScript/JavaScript 关键字
const TS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'class', 'interface', 'type',
  'import', 'export', 'from', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'super',
  'extends', 'implements', 'async', 'await', 'yield', 'throw', 'try',
  'catch', 'finally', 'typeof', 'instanceof', 'in', 'of', 'as',
  'true', 'false', 'null', 'undefined', 'void', 'never', 'enum',
  'default', 'static', 'readonly', 'abstract', 'declare',
])

// TypeScript 类型关键字
const TS_TYPES = new Set([
  'string', 'number', 'boolean', 'object', 'any', 'unknown',
  'void', 'never', 'null', 'undefined', 'Symbol', 'BigInt',
  'Array', 'Map', 'Set', 'Promise', 'Record', 'Partial',
  'Required', 'Readonly', 'Pick', 'Omit',
])

// 简易 token 化（逐行处理）
function tokenizeLine(line: string, theme: CodeTheme): string {
  let result = ''
  let i = 0

  while (i < line.length) {
    // 单行注释
    if (line[i] === '/' && line[i + 1] === '/') {
      result += style(line.slice(i), theme.comment)
      break
    }

    // 字符串 (单引号/双引号/模板)
    const quoteChar = line[i]
    if (quoteChar === '"' || quoteChar === "'" || quoteChar === '`') {
      let end = i + 1
      while (end < line.length && line[end] !== quoteChar) {
        if (line[end] === '\\') end++ // 跳过转义
        end++
      }
      end++ // 包含闭合引号
      result += style(line.slice(i, end), theme.string)
      i = end
      continue
    }

    // 数字
    if (/[0-9]/.test(line[i] ?? '')) {
      let end = i
      while (end < line.length && /[0-9.xXa-fA-F_n]/.test(line[end] ?? '')) {
        end++
      }
      result += style(line.slice(i, end), theme.number)
      i = end
      continue
    }

    // 标识符 / 关键字
    if (/[a-zA-Z_$]/.test(line[i] ?? '')) {
      let end = i
      while (end < line.length && /[a-zA-Z0-9_$]/.test(line[end] ?? '')) {
        end++
      }
      const word = line.slice(i, end)

      if (TS_KEYWORDS.has(word)) {
        result += style(word, theme.keyword)
      } else if (TS_TYPES.has(word)) {
        result += style(word, theme.type)
      } else if (line[end] === '(') {
        result += style(word, theme.function)
      } else {
        result += word
      }
      i = end
      continue
    }

    // 标点符号
    if (/[{}()[\];:,.<>+=\-*/%!&|^~?@#]/.test(line[i] ?? '')) {
      result += style(line[i] ?? '', theme.punctuation)
      i++
      continue
    }

    // 其他（空格等）
    result += line[i] ?? ''
    i++
  }

  return result
}

// Markdown 渲染器
export class MarkdownComponent implements Component {
  private content = ''
  private readonly codeTheme: CodeTheme

  constructor(config: MarkdownConfig = {}) {
    this.codeTheme = config.codeTheme ?? DEFAULT_CODE_THEME
  }

  render(width: number): string[] {
    return this.renderMarkdown(this.content, width)
  }

  setContent(content: string): void {
    this.content = content
  }

  getContent(): string {
    return this.content
  }

  private renderMarkdown(text: string, _width: number): string[] {
    const lines = text.split('\n')
    const result: string[] = []
    let inCodeBlock = false
    let codeLanguage = ''

    for (const line of lines) {
      // 代码块开始/结束
      if (line.trimStart().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeLanguage = line.trimStart().slice(3).trim()
          result.push(style('  ' + '─'.repeat(40), COLORS.gray))
          continue
        }
        inCodeBlock = false
        codeLanguage = ''
        result.push(style('  ' + '─'.repeat(40), COLORS.gray))
        continue
      }

      if (inCodeBlock) {
        // 代码块内：根据语言进行高亮
        const highlighted = this.highlightCode(line, codeLanguage)
        result.push('  ' + highlighted)
        continue
      }

      // 标题
      const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)
      if (headingMatch) {
        const level = (headingMatch[1] ?? '').length
        const text = headingMatch[2] ?? ''
        const prefix = level <= 2 ? COLORS.bold : ''
        result.push(style(text, prefix + COLORS.brightCyan))
        continue
      }

      // 列表项
      if (/^\s*[-*+]\s/.test(line)) {
        const trimmed = line.replace(/^(\s*)[-*+]\s/, '$1● ')
        result.push(this.renderInline(trimmed))
        continue
      }

      // 引用
      if (line.startsWith('>')) {
        const content = line.slice(1).trim()
        result.push(style('│ ' + content, COLORS.gray))
        continue
      }

      // 分隔线
      if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
        result.push(style('─'.repeat(40), COLORS.gray))
        continue
      }

      // 普通文本
      result.push(this.renderInline(line))
    }

    return result
  }

  // 高亮代码
  private highlightCode(line: string, language: string): string {
    if (language === 'ts' || language === 'typescript' ||
        language === 'js' || language === 'javascript' ||
        language === 'tsx' || language === 'jsx') {
      return tokenizeLine(line, this.codeTheme)
    }
    // 其他语言：简单灰色
    return style(line, COLORS.white)
  }

  // 渲染行内元素（粗体/斜体/代码/链接）
  private renderInline(line: string): string {
    let result = line

    // 行内代码 `code`
    result = result.replace(/`([^`]+)`/g, (_m, code: string) => {
      return style(code, COLORS.brightYellow)
    })

    // 粗体 **bold**
    result = result.replace(/\*\*([^*]+)\*\*/g, (_m, text: string) => {
      return style(text, COLORS.bold)
    })

    // 斜体 *italic*
    result = result.replace(/\*([^*]+)\*/g, (_m, text: string) => {
      return style(text, COLORS.italic)
    })

    // 链接 [text](url) → text (url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
      return style(text, COLORS.underline + COLORS.brightBlue) + style(' (' + url + ')', COLORS.gray)
    })

    return result
  }
}

// 工厂函数
export function createMarkdownComponent(config?: MarkdownConfig): MarkdownComponent {
  return new MarkdownComponent(config)
}
