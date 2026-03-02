import React, { useEffect, useRef, useState } from 'react'

interface ThinkingEntry {
  id: string
  agentId: string
  timestamp: number
  content: string
  isStreaming: boolean
}

export const ThinkingLog: React.FC = () => {
  const [entries, setEntries] = useState<ThinkingEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let eventSource: EventSource | null = null

    try {
      eventSource = new EventSource('/api/logs/stream?sources=thinking')

      eventSource.addEventListener('log', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as ThinkingEntry
          setEntries((prev) => {
            // 更新已有的 streaming entry 或追加新条目
            const existing = prev.findIndex((e) => e.id === data.id)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = data
              return updated
            }
            // 保留最近 200 条
            const next = [...prev, data]
            return next.length > 200 ? next.slice(-200) : next
          })
        } catch {
          // 解析失败静默忽略
        }
      })
    } catch {
      // SSE 不可用时回退轮询
      const timer = setInterval(async () => {
        try {
          const res = await fetch('/api/logs?sources=thinking&limit=50')
          if (res.ok) {
            const data = await res.json() as ThinkingEntry[]
            setEntries(data)
          }
        } catch {
          // 忽略
        }
      }, 3000)

      return () => clearInterval(timer)
    }

    return () => {
      eventSource?.close()
    }
  }, [])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, autoScroll])

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Thinking Log</h3>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          自动滚动
        </label>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {entries.map((entry) => {
          const isExpanded = expandedIds.has(entry.id)
          const preview = entry.content.slice(0, 200)
          const needsExpand = entry.content.length > 200

          return (
            <div
              key={entry.id}
              style={{
                padding: '8px 12px',
                marginBottom: '4px',
                background: entry.isStreaming ? '#fffbeb' : '#f9fafb',
                borderLeft: `3px solid ${entry.isStreaming ? '#f59e0b' : '#6366f1'}`,
                borderRadius: '2px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
                <span>{entry.agentId}</span>
                <span>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                  {entry.isStreaming && <span style={{ color: '#f59e0b', marginLeft: '6px' }}>● streaming</span>}
                </span>
              </div>
              <pre style={{ margin: '4px 0 0', fontSize: '12px', whiteSpace: 'pre-wrap', color: '#374151' }}>
                {isExpanded ? entry.content : preview}
                {needsExpand && !isExpanded && '...'}
              </pre>
              {needsExpand && (
                <button
                  onClick={() => toggleExpanded(entry.id)}
                  style={{ fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                >
                  {isExpanded ? '收起' : '展开全部'}
                </button>
              )}
            </div>
          )
        })}
        {entries.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', padding: '32px' }}>暂无 Thinking 日志</div>
        )}
      </div>
    </div>
  )
}
