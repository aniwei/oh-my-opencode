import type { Options as RemarkGfmOptions } from 'remark-gfm'
import type { Options as RemarkMathOptions } from 'remark-math'

/**
 * remark-gfm 配置：启用表格、删除线、任务列表、自动链接
 */
export const remarkGfmOptions: RemarkGfmOptions = {
  singleTilde: false,
}

/**
 * remark-math 配置：KaTeX 行内与块级公式
 */
export const remarkMathOptions: RemarkMathOptions = {
  singleDollarTextMath: true,
}

/**
 * 从 fenced code block 类名中提取语言标识
 */
export function extractLanguage(className: string | undefined): string {
  if (!className) {
    return ''
  }

  const match = className.match(/language-(\S+)/)
  return match ? match[1] : ''
}

/**
 * 判断代码块是否为 Mermaid 图表
 */
export function isMermaidBlock(language: string): boolean {
  return language.toLowerCase() === 'mermaid'
}

/**
 * 清除代码块末尾的换行符
 */
export function cleanCodeContent(content: string): string {
  return content.replace(/\n$/, '')
}
