import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssistantMessage } from '../../src/components/chat/assistant-message'
import { TestWrapper } from './test-wrapper'
import type { ChatMessage } from '../../src/types/message'

function createAssistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-a1',
    role: 'assistant',
    content: '这是 AI 的回复',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('AssistantMessage', () => {
  describe('#given 纯文本回复', () => {
    describe('#when 渲染组件', () => {
      it('#then 正确显示 Markdown 内容', () => {
        render(
          <TestWrapper>
            <AssistantMessage message={createAssistantMessage({ content: '你好，这是**回复**' })} />
          </TestWrapper>,
        )

        expect(screen.getByText(/回复/)).toBeInTheDocument()
      })
    })
  })

  describe('#given 带有思考过程的回复', () => {
    describe('#when thinking 字段不为空', () => {
      it('#then 渲染 ThinkingBlock', () => {
        render(
          <TestWrapper>
            <AssistantMessage
              message={createAssistantMessage({ thinking: '让我思考一下...' })}
            />
          </TestWrapper>,
        )

        expect(screen.getByText(/思考过程/)).toBeInTheDocument()
      })
    })
  })

  describe('#given 没有思考过程的回复', () => {
    describe('#when thinking 为 undefined', () => {
      it('#then 不渲染 ThinkingBlock', () => {
        render(
          <TestWrapper>
            <AssistantMessage message={createAssistantMessage()} />
          </TestWrapper>,
        )

        expect(screen.queryByText(/思考过程/)).not.toBeInTheDocument()
      })
    })
  })

  describe('#given 带有工具调用的回复', () => {
    describe('#when toolCalls 包含条目', () => {
      it('#then 渲染 ToolCallCard', () => {
        render(
          <TestWrapper>
            <AssistantMessage
              message={createAssistantMessage({
                toolCalls: [
                  { id: 'tc-1', name: 'read_file', status: 'success', durationMs: 50 },
                ],
              })}
            />
          </TestWrapper>,
        )

        expect(screen.getByText('read_file')).toBeInTheDocument()
        expect(screen.getByText('成功')).toBeInTheDocument()
      })
    })
  })
})
