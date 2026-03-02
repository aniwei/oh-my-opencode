import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserMessage } from '../../src/components/chat/user-message'
import { TestWrapper } from './test-wrapper'
import type { ChatMessage } from '../../src/types/message'

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: '你好世界',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('UserMessage', () => {
  describe('#given 纯文本消息', () => {
    describe('#when 渲染组件', () => {
      it('#then 正确显示文本内容', () => {
        render(
          <TestWrapper>
            <UserMessage message={createMessage({ content: '这是一段纯文本' })} />
          </TestWrapper>,
        )

        expect(screen.getByText('这是一段纯文本')).toBeInTheDocument()
      })
    })
  })

  describe('#given 包含 Markdown 特征的消息', () => {
    describe('#when 内容包含代码块', () => {
      it('#then 使用 MarkdownRenderer 渲染', () => {
        const content = '```js\nconsole.log("hi")\n```'

        render(
          <TestWrapper>
            <UserMessage message={createMessage({ content })} />
          </TestWrapper>,
        )

        expect(screen.getByText(/console\.log/)).toBeInTheDocument()
      })
    })
  })

  describe('#given 包含附件的消息', () => {
    describe('#when 附件为文件类型', () => {
      it('#then 显示文件名', () => {
        render(
          <TestWrapper>
            <UserMessage
              message={createMessage({
                attachments: [
                  { name: 'readme.md', type: 'file', url: '/files/readme.md' },
                ],
              })}
            />
          </TestWrapper>,
        )

        expect(screen.getByText('readme.md')).toBeInTheDocument()
      })
    })

    describe('#when 附件为图片类型', () => {
      it('#then 渲染图片元素', () => {
        render(
          <TestWrapper>
            <UserMessage
              message={createMessage({
                attachments: [
                  { name: 'screenshot.png', type: 'image', url: '/images/shot.png' },
                ],
              })}
            />
          </TestWrapper>,
        )

        const image = screen.getByAltText('screenshot.png')
        expect(image).toBeInTheDocument()
        expect(image).toHaveAttribute('src', '/images/shot.png')
      })
    })
  })

  describe('#given 无附件的消息', () => {
    describe('#when attachments 为 undefined', () => {
      it('#then 不渲染附件区域', () => {
        const { container } = render(
          <TestWrapper>
            <UserMessage message={createMessage()} />
          </TestWrapper>,
        )

        expect(container.querySelectorAll('img')).toHaveLength(0)
      })
    })
  })
})
