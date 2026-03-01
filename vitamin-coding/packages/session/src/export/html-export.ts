// HTML 会话导出
// 将会话消息导出为可阅读的 HTML 文件，支持语法高亮
import type { Message } from '@vitamin/ai'

import type { HtmlExportOptions, SessionMetadata } from '../types'

// 转义 HTML 特殊字符
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 简单代码高亮（给代码块添加 <code> 标签）
function highlightCodeBlocks(text: string): string {
  // 处理 fenced code blocks
  const escaped = escapeHtml(text)
  return escaped.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const langAttr = lang ? ` data-language="${lang}"` : ''
      return `<pre><code${langAttr}>${code}</code></pre>`
    },
  )
}

// 行内代码处理
function highlightInlineCode(text: string): string {
  return text.replace(
    /`([^`]+)`/g,
    '<code class="inline">$1</code>',
  )
}

// 渲染单条消息为 HTML
function renderMessage(msg: Message, syntaxHighlight: boolean): string {
  const parts: string[] = []

  if (msg.role === 'user') {
    const text = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map((p) => (p.type === 'text' ? p.text : `[${p.type}]`)).join('\n')

    const rendered = syntaxHighlight
      ? highlightInlineCode(highlightCodeBlocks(text))
      : escapeHtml(text)

    parts.push(`<div class="message user">`)
    parts.push(`<div class="role">User</div>`)
    parts.push(`<div class="content">${rendered}</div>`)
    parts.push(`</div>`)
  } else if (msg.role === 'assistant') {
    const textParts = msg.content
      .filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('\n\n')

    const rendered = syntaxHighlight
      ? highlightInlineCode(highlightCodeBlocks(textParts))
      : escapeHtml(textParts)

    parts.push(`<div class="message assistant">`)
    parts.push(`<div class="role">Assistant</div>`)
    parts.push(`<div class="content">${rendered}</div>`)
    parts.push(`</div>`)
  } else if (msg.role === 'tool_result') {
    const textContent = msg.content
      .filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('\n')

    if (textContent) {
      const rendered = syntaxHighlight
        ? highlightCodeBlocks(textContent)
        : escapeHtml(textContent)

      parts.push(`<div class="message tool">`)
      parts.push(`<div class="role">Tool Result</div>`)
      parts.push(`<div class="content">${rendered}</div>`)
      parts.push(`</div>`)
    }
  }

  return parts.join('\n')
}

// CSS 样式（内联到 HTML 中）
function getStyles(theme: 'light' | 'dark'): string {
  const isDark = theme === 'dark'
  const bg = isDark ? '#1e1e2e' : '#ffffff'
  const text = isDark ? '#cdd6f4' : '#1e1e2e'
  const userBg = isDark ? '#313244' : '#e8f0fe'
  const assistantBg = isDark ? '#1e1e2e' : '#f8f9fa'
  const toolBg = isDark ? '#45475a' : '#fff3cd'
  const codeBg = isDark ? '#181825' : '#f5f5f5'
  const borderColor = isDark ? '#45475a' : '#dee2e6'

  return `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bg}; color: ${text}; max-width: 900px; margin: 0 auto; padding: 20px; }
    .message { margin: 16px 0; padding: 12px 16px; border-radius: 8px; border: 1px solid ${borderColor}; }
    .message.user { background: ${userBg}; }
    .message.assistant { background: ${assistantBg}; }
    .message.tool { background: ${toolBg}; }
    .role { font-weight: 600; font-size: 0.85em; margin-bottom: 8px; opacity: 0.7; }
    .content { white-space: pre-wrap; line-height: 1.6; }
    pre { background: ${codeBg}; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.9em; }
    code.inline { background: ${codeBg}; padding: 2px 6px; border-radius: 3px; }
    .metadata { color: ${isDark ? '#6c7086' : '#6c757d'}; font-size: 0.85em; margin-bottom: 20px;
      padding-bottom: 12px; border-bottom: 1px solid ${borderColor}; }
    h1 { font-size: 1.5em; }
  `
}

// 导出会话为 HTML
export function exportToHtml(
  messages: Message[],
  metadata?: Partial<SessionMetadata>,
  options: HtmlExportOptions = {},
): string {
  const {
    title = metadata?.title ?? 'Vitamin Session',
    includeMetadata = true,
    syntaxHighlight = true,
    theme = 'light',
  } = options

  const parts: string[] = []
  parts.push('<!DOCTYPE html>')
  parts.push(`<html lang="zh-CN">`)
  parts.push('<head>')
  parts.push(`<meta charset="UTF-8">`)
  parts.push(`<meta name="viewport" content="width=device-width, initial-scale=1.0">`)
  parts.push(`<title>${escapeHtml(title)}</title>`)
  parts.push(`<style>${getStyles(theme)}</style>`)
  parts.push('</head>')
  parts.push('<body>')
  parts.push(`<h1>${escapeHtml(title)}</h1>`)

  if (includeMetadata && metadata) {
    parts.push('<div class="metadata">')
    if (metadata.createdAt) {
      parts.push(`<div>创建时间: ${new Date(metadata.createdAt).toLocaleString('zh-CN')}</div>`)
    }
    if (metadata.messageCount !== undefined) {
      parts.push(`<div>消息数: ${metadata.messageCount}</div>`)
    }
    if (metadata.tags && metadata.tags.length > 0) {
      parts.push(`<div>标签: ${metadata.tags.map(escapeHtml).join(', ')}</div>`)
    }
    parts.push('</div>')
  }

  for (const msg of messages) {
    parts.push(renderMessage(msg, syntaxHighlight))
  }

  parts.push('</body>')
  parts.push('</html>')

  return parts.join('\n')
}
