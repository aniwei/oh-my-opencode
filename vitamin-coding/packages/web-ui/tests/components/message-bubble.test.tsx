import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../../src/components/chat/message-bubble'
import { TestWrapper } from './test-wrapper'
import type { ChatMessage } from '../../src/types/message'

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('MessageBubble', () => {
  describe('#given user 角色的消息', () => {
    describe('#when 渲染', () => {
      it('#then 委托给 UserMessage 组件', () => {
        render(
          <TestWrapper>
            <MessageBubble message={createMessage({ role: 'user', content: 'user message' })} />
          </TestWrapper>,
        )

        expect(screen.getByText('user message')).toBeInTheDocument()
      })
    })
  })

  describe('#given assistant 角色的消息', () => {
    describe('#when 渲染', () => {
      it('#then 委托给 AssistantMessage 组件', () => {
        render(
          <TestWrapper>
            <MessageBubble
              message={createMessage({ role: 'assistant', content: 'assistant reply' })}
            />
          </TestWrapper>,
        )

        expect(screen.getByText('assistant reply')).toBeInTheDocument()
      })
    })
  })

  describe('#given system 角色的消息', () => {
    describe('#when 渲染', () => {
      it('#then 直接显示文本内容', () => {
        render(
          <TestWrapper>
            <MessageBubble
              message={createMessage({ role: 'system', content: 'system notice' })}
            />
          </TestWrapper>,
        )

        expect(screen.getByText('system notice')).toBeInTheDocument()
      })
    })
  })
})
