import { useEffect, useState } from 'react'

export interface ToolCallRecord {
  id: string
  name: string
  status: string
  durationMs?: number
}

export interface AgentStatusSnapshot {
  state: 'idle' | 'running' | 'error'
  lastUpdatedAt: number
  toolCalls: number
  inputTokens: number
  outputTokens: number
  recentToolCalls: ToolCallRecord[]
}

const INITIAL: AgentStatusSnapshot = {
  state: 'idle',
  lastUpdatedAt: Date.now(),
  toolCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  recentToolCalls: [],
}

interface AgentApiResponse {
  state?: 'idle' | 'running' | 'error'
  toolCalls?: number
  inputTokens?: number
  outputTokens?: number
  recentToolCalls?: ToolCallRecord[]
}

export function useAgentStatus(agentId: string) {
  const [status, setStatus] = useState<AgentStatusSnapshot>(INITIAL)

  useEffect(() => {
    let active = true

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}/status`)
        if (!response.ok) {
          return
        }

        const payload = await response.json() as AgentApiResponse
        if (!active) {
          return
        }

        setStatus({
          state: payload.state ?? 'idle',
          lastUpdatedAt: Date.now(),
          toolCalls: payload.toolCalls ?? 0,
          inputTokens: payload.inputTokens ?? 0,
          outputTokens: payload.outputTokens ?? 0,
          recentToolCalls: payload.recentToolCalls ?? [],
        })
      } catch {
        if (!active) {
          return
        }

        setStatus((prev) => ({
          ...prev,
          state: 'error',
          lastUpdatedAt: Date.now(),
        }))
      }
    }

    void fetchStatus()
    const timer = setInterval(() => {
      void fetchStatus()
    }, 3000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [agentId])

  return status
}
