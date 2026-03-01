// 压缩时 Todo 状态保留
// 扫描消息中的 todo list，提取并保留状态
import type { Message } from '@vitamin/ai'

// Todo 项
export interface TodoItem {
  text: string
  completed: boolean
}

// 从消息内容中提取 todo 项（匹配 markdown checkbox）
export function extractTodoItems(text: string): TodoItem[] {
  const items: TodoItem[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // 匹配 - [x] 或 - [ ] 格式
    const checkboxMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/)
    if (checkboxMatch && checkboxMatch[1] !== undefined && checkboxMatch[2] !== undefined) {
      items.push({
        completed: checkboxMatch[1].toLowerCase() === 'x',
        text: checkboxMatch[2].trim(),
      })
    }
  }

  return items
}

// 从消息列表中提取所有 todo 状态
export function extractTodoState(messages: Message[]): string | undefined {
  const allItems: TodoItem[] = []

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      for (const part of msg.content) {
        if (part.type === 'text') {
          const items = extractTodoItems(part.text)
          allItems.push(...items)
        }
      }
    } else if (msg.role === 'user' && typeof msg.content === 'string') {
      const items = extractTodoItems(msg.content)
      allItems.push(...items)
    }
  }

  if (allItems.length === 0) {
    return undefined
  }

  // 按最新状态去重（同名 todo 取最后出现的状态）
  const latestState = new Map<string, boolean>()
  for (const item of allItems) {
    latestState.set(item.text, item.completed)
  }

  // 格式化输出
  const lines: string[] = []
  for (const [text, completed] of latestState) {
    lines.push(`- [${completed ? 'x' : ' '}] ${text}`)
  }

  return lines.join('\n')
}

// 将 todo 状态注入到摘要末尾
export function appendTodoState(summary: string, todoState: string | undefined): string {
  if (!todoState) {
    return summary
  }

  return `${summary}\n\n## Active Todos\n${todoState}`
}
