// HTML 导出测试
import { exportToHtml } from '../src/export/html-export'

import type { Message } from '@vitamin/ai'

function makeUserMsg(text: string): Message {
  return { role: 'user', content: text, timestamp: Date.now() }
}

function makeAssistantMsg(text: string): Message {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    stopReason: 'end_turn',
    model: 'test',
  }
}

describe('exportToHtml', () => {
  describe('#given 基本消息列表', () => {
    describe('#when 导出', () => {
      it('#then 输出合法 HTML', () => {
        const messages: Message[] = [
          makeUserMsg('你好'),
          makeAssistantMsg('你好！有什么可以帮你的？'),
        ]

        const html = exportToHtml(messages)
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<html')
        expect(html).toContain('你好')
        expect(html).toContain('有什么可以帮你的')
      })
    })
  })

  describe('#given 含代码块的消息', () => {
    describe('#when syntaxHighlight=true', () => {
      it('#then 含 <code> 标签', () => {
        const messages: Message[] = [
          makeAssistantMsg('示例代码：\n```ts\nconst x = 42\n```'),
        ]

        const html = exportToHtml(messages, undefined, { syntaxHighlight: true })
        expect(html).toContain('<code')
        expect(html).toContain('const x = 42')
      })
    })
  })

  describe('#given 含行内代码', () => {
    describe('#when 导出', () => {
      it('#then 用 <code class="inline"> 包裹', () => {
        const messages: Message[] = [
          makeAssistantMsg('使用 `npm install` 安装'),
        ]

        const html = exportToHtml(messages)
        expect(html).toContain('<code class="inline">')
        expect(html).toContain('npm install')
      })
    })
  })

  describe('#given 元数据', () => {
    describe('#when includeMetadata=true', () => {
      it('#then 显示元数据', () => {
        const html = exportToHtml(
          [makeUserMsg('hi')],
          {
            id: 'test-id',
            title: '测试会话',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 1,
            tags: ['tag1', 'tag2'],
          },
          { includeMetadata: true },
        )

        expect(html).toContain('测试会话')
        expect(html).toContain('tag1')
        expect(html).toContain('消息数: 1')
      })
    })
  })

  describe('#given 自定义选项', () => {
    describe('#when theme=dark', () => {
      it('#then 使用暗色主题样式', () => {
        const html = exportToHtml([makeUserMsg('test')], undefined, { theme: 'dark' })
        expect(html).toContain('#1e1e2e') // 暗色背景色
      })
    })

    describe('#when 自定义 title', () => {
      it('#then 使用指定标题', () => {
        const html = exportToHtml([makeUserMsg('test')], undefined, { title: '自定义标题' })
        expect(html).toContain('自定义标题')
      })
    })
  })

  describe('#given HTML 特殊字符', () => {
    describe('#when 消息含 < > & 字符', () => {
      it('#then 正确转义', () => {
        const messages: Message[] = [
          makeUserMsg('a < b && c > d'),
        ]

        const html = exportToHtml(messages)
        expect(html).toContain('&lt;')
        expect(html).toContain('&gt;')
        expect(html).toContain('&amp;')
        expect(html).not.toContain('a < b &&')
      })
    })
  })

  describe('#given tool_result 消息', () => {
    describe('#when 导出', () => {
      it('#then 包含工具结果内容', () => {
        const messages: Message[] = [
          {
            role: 'tool_result',
            toolCallId: 'tool-1',
            content: [{ type: 'text', text: '工具执行结果' }],
            isError: false,
          },
        ]

        const html = exportToHtml(messages)
        expect(html).toContain('工具执行结果')
        expect(html).toContain('Tool Result')
      })
    })
  })
})
