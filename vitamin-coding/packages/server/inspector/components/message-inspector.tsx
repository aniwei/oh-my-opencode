import React, { useEffect, useState } from 'react'

interface MessageEntry {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  toolName?: string
  tokenCount?: number
}

// 四色高亮映射
const ROLE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  system: { bg: '#f0f4ff', border: '#6366f1', label: 'System' },
  user: { bg: '#f0fdf4', border: '#22c55e', label: 'User' },
  assistant: { bg: '#fef9ee', border: '#f59e0b', label: 'Assistant' },
  tool: { bg: '#fdf2f8', border: '#ec4899', label: 'Tool' },
}

export const MessageInspector: React.FC = () => {
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sessionFilter, setSessionFilter] = useState('')

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const url = sessionFilter
          ? `/api/logs?sources=message&session=${sessionFilter}`
          : '/api/logs?sources=message'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json() as MessageEntry[]
          setMessages(data)
        }
      } catch {
        // 轮询失败时静默忽略
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [sessionFilter])

  const selected = messages.find((m) => m.id === selectedId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #ddd', display: 'flex', gap: '8px' }}>
        <h3 style={{ margin: 0 }}>Message Inspector</h3>
        <input
          type="text"
          placeholder="Session ID 过滤..."
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          style={{ flex: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 消息列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {messages.map((msg) => {
            const colors = ROLE_COLORS[msg.role] ?? ROLE_COLORS.system
            return (
              <div
                key={msg.id}
                onClick={() => setSelectedId(msg.id)}
                style={{
                  padding: '8px 12px',
                  marginBottom: '4px',
                  background: selectedId === msg.id ? '#e5e7eb' : colors.bg,
                  borderLeft: `4px solid ${colors.border}`,
                  cursor: 'pointer',
                  borderRadius: '2px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: colors.border }}>{colors.label}</span>
                  <span style={{ color: '#999' }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ fontSize: '13px', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {msg.toolName ? `[${msg.toolName}] ` : ''}{msg.content.slice(0, 120)}
                </div>
              </div>
            )
          })}
          {messages.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '32px' }}>暂无消息</div>
          )}
        </div>
        {/* 详情面板 */}
        {selected && (
          <div style={{ width: '400px', borderLeft: '1px solid #ddd', padding: '16px', overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 8px' }}>消息详情</h4>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              <div>ID: {selected.id}</div>
              <div>Role: {selected.role}</div>
              <div>Time: {new Date(selected.timestamp).toLocaleString()}</div>
              {selected.toolName && <div>Tool: {selected.toolName}</div>}
              {selected.tokenCount && <div>Tokens: {String(selected.tokenCount)}</div>}
            </div>
            <pre style={{ background: '#f8f8f8', padding: '12px', borderRadius: '4px', fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
              {selected.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
