import type { StreamEvent } from '../types/api'
import type { SessionSummary, ClientConfig, ModelsResponse } from '../types/api'
import type { AgentInfo, AgentStatusDetail } from './agent-api'
import type { SendMessageInput } from './chat-api'
import type { SessionDetail } from './session-api'

type MockMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

const LATENCY_MS = 80

const mockConfig: ClientConfig = {
  theme: 'dark',
  features: ['multi-agent', 'plan-mode', 'mock-api'],
  limits: {
    maxFileSizeMb: 15,
    maxAttachments: 8,
  },
}

const mockModels: ModelsResponse = {
  source: 'registry',
  models: [
    {
      id: 'claude-3-7-sonnet',
      provider: 'anthropic',
      displayName: 'Claude 3.7 Sonnet',
      supportsVision: true,
    },
    {
      id: 'gpt-4o',
      provider: 'openai',
      displayName: 'GPT-4o',
      supportsVision: true,
    },
    {
      id: 'gemini-2.0-flash',
      provider: 'google',
      displayName: 'Gemini 2.0 Flash',
      supportsVision: true,
    },
  ],
}

const mockAgents: AgentInfo[] = [
  {
    id: 'sisyphus',
    name: 'Sisyphus',
    description: '通用主代理，擅长分解任务与执行编码工作。',
    capabilities: ['planning', 'coding', 'tool-use'],
    state: 'idle',
  },
  {
    id: 'hephaestus',
    name: 'Hephaestus',
    description: '实现导向代理，擅长批量改动与重构。',
    capabilities: ['refactor', 'typescript', 'workspace-edit'],
    state: 'running',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    description: '分析导向代理，擅长代码检索与风险识别。',
    capabilities: ['analysis', 'search', 'review'],
    state: 'idle',
  },
]

const sessionStore = new Map<string, SessionSummary>()
const messageStore = new Map<string, MockMessage[]>()

bootstrap()

function bootstrap() {
  const sessionId = 'mock-session-1'
  const now = Date.now()

  sessionStore.set(sessionId, {
    id: sessionId,
    title: 'Mock 对话示例',
    createdAt: now - 120_000,
    updatedAt: now - 60_000,
    messageCount: 2,
  })

  messageStore.set(sessionId, [
    {
      id: 'mock-msg-1',
      role: 'user',
      content: '先帮我看下项目结构。',
      timestamp: now - 110_000,
    },
    {
      id: 'mock-msg-2',
      role: 'assistant',
      content: '已读取 workspace 结构，建议先从 services 层做 mock-first。',
      timestamp: now - 100_000,
    },
  ])
}

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function listSortedSessions(): SessionSummary[] {
  return [...sessionStore.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

function mockReply(input: string): string {
  const normalized = input.trim()
  if (!normalized) {
    return '我已收到你的消息。'
  }
  return `这是 Mock 回复：已处理“${normalized}”。当前界面数据来自本地 mock backend。`
}

export const mockBackend = {
  async listSessions(): Promise<SessionSummary[]> {
    await delay()
    return listSortedSessions()
  },

  async createSession(title?: string): Promise<SessionSummary> {
    await delay()

    const now = Date.now()
    const id = genId('mock-session')
    const summary: SessionSummary = {
      id,
      title: title?.trim() || '新建 Mock 会话',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    }

    sessionStore.set(id, summary)
    messageStore.set(id, [])
    return summary
  },

  async getSession(sessionId: string): Promise<SessionDetail> {
    await delay()

    const summary = sessionStore.get(sessionId)
    if (!summary) {
      throw new Error('Session not found')
    }

    const messages = messageStore.get(sessionId) ?? []
    return {
      ...summary,
      messages,
    }
  },

  async removeSession(sessionId: string): Promise<{ removed: true }> {
    await delay()

    sessionStore.delete(sessionId)
    messageStore.delete(sessionId)
    return { removed: true }
  },

  async listAgents(): Promise<{ agents: AgentInfo[] }> {
    await delay()
    return { agents: mockAgents }
  },

  async getAgentStatus(_agentId: string): Promise<AgentStatusDetail> {
    await delay()
    return {
      state: 'idle',
      toolCalls: 12,
      inputTokens: 4832,
      outputTokens: 9120,
      recentToolCalls: [
        {
          id: 'mock-tool-1',
          name: 'read_file',
          status: 'success',
          durationMs: 42,
        },
        {
          id: 'mock-tool-2',
          name: 'apply_patch',
          status: 'success',
          durationMs: 136,
        },
      ],
    }
  },

  async getConfig(): Promise<ClientConfig> {
    await delay()
    return mockConfig
  },

  async listModels(): Promise<ModelsResponse> {
    await delay()
    return mockModels
  },

  async *sendMessage(sessionId: string, input: SendMessageInput): AsyncGenerator<StreamEvent> {
    await delay(50)

    if (!sessionStore.has(sessionId)) {
      throw new Error('Session not found')
    }

    const userMessage: MockMessage = {
      id: genId('mock-user-msg'),
      role: 'user',
      content: input.content,
      timestamp: Date.now(),
    }
    const messages = messageStore.get(sessionId) ?? []
    messages.push(userMessage)

    const assistantMessageId = genId('mock-assistant-msg')
    const reply = mockReply(input.content)
    const chunks = reply.match(/.{1,16}/g) ?? [reply]

    for (const chunk of chunks) {
      await delay(40)
      yield {
        type: 'text_delta',
        data: { delta: chunk },
      }
    }

    const assistantMessage: MockMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
    }
    messages.push(assistantMessage)

    const summary = sessionStore.get(sessionId)
    if (summary) {
      sessionStore.set(sessionId, {
        ...summary,
        updatedAt: Date.now(),
        messageCount: messages.length,
      })
    }

    messageStore.set(sessionId, messages)

    yield {
      type: 'done',
      data: {
        messageId: assistantMessageId,
        inputTokens: Math.ceil(input.content.length / 3),
        outputTokens: Math.ceil(reply.length / 3),
      },
    }
  },

  async stopMessage(_sessionId: string, _messageId: string): Promise<{ stopped: boolean }> {
    await delay(20)
    return { stopped: true }
  },
}
