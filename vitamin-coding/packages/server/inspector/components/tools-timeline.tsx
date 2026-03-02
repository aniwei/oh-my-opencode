import React, { useEffect, useState } from 'react'

interface ToolTimelineEntry {
  id: string
  name: string
  agentId: string
  startTime: number
  endTime?: number
  status: 'running' | 'success' | 'error'
  durationMs?: number
}

const STATUS_COLORS: Record<string, string> = {
  running: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444',
}

export const ToolsTimeline: React.FC = () => {
  const [entries, setEntries] = useState<ToolTimelineEntry[]>([])
  const [timeRange, setTimeRange] = useState<{ start: number; end: number }>({
    start: Date.now() - 60_000,
    end: Date.now(),
  })

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/logs?sources=tool&limit=100')
        if (res.ok) {
          const data = await res.json() as ToolTimelineEntry[]
          setEntries(data)

          // 更新时间范围
          if (data.length > 0) {
            const starts = data.map((d) => d.startTime)
            const ends = data.map((d) => d.endTime ?? Date.now())
            setTimeRange({
              start: Math.min(...starts),
              end: Math.max(...ends),
            })
          }
        }
      } catch {
        // 轮询失败静默忽略
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [])

  const totalDuration = Math.max(timeRange.end - timeRange.start, 1)

  // 按 Agent 分组
  const agentGroups = new Map<string, ToolTimelineEntry[]>()
  for (const entry of entries) {
    const group = agentGroups.get(entry.agentId) ?? []
    group.push(entry)
    agentGroups.set(entry.agentId, group)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
        <h3 style={{ margin: 0 }}>Tools Timeline</h3>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
          {entries.length} 个工具调用 · 
          时间范围 {new Date(timeRange.start).toLocaleTimeString()} → {new Date(timeRange.end).toLocaleTimeString()}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* 时间刻度 */}
        <div style={{ position: 'relative', height: '20px', borderBottom: '1px solid #e5e7eb', marginBottom: '8px' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <span
              key={pct}
              style={{
                position: 'absolute',
                left: `${pct * 100}%`,
                fontSize: '10px',
                color: '#999',
                transform: 'translateX(-50%)',
              }}
            >
              {new Date(timeRange.start + totalDuration * pct).toLocaleTimeString()}
            </span>
          ))}
        </div>

        {/* 甘特图行 */}
        {[...agentGroups.entries()].map(([agentId, tools]) => (
          <div key={agentId} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}>
              {agentId}
            </div>
            <div style={{ position: 'relative', height: `${tools.length * 24}px`, background: '#f9fafb', borderRadius: '4px' }}>
              {tools.map((tool, idx) => {
                const left = ((tool.startTime - timeRange.start) / totalDuration) * 100
                const width = (((tool.endTime ?? Date.now()) - tool.startTime) / totalDuration) * 100

                return (
                  <div
                    key={tool.id}
                    title={`${tool.name} — ${tool.durationMs ? `${String(tool.durationMs)}ms` : 'running'}`}
                    style={{
                      position: 'absolute',
                      top: `${idx * 24 + 2}px`,
                      left: `${Math.max(0, left)}%`,
                      width: `${Math.max(0.5, Math.min(width, 100 - left))}%`,
                      height: '20px',
                      background: STATUS_COLORS[tool.status] ?? STATUS_COLORS.running,
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: '4px',
                      fontSize: '10px',
                      color: 'white',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tool.name}
                    {tool.durationMs !== undefined && ` (${String(tool.durationMs)}ms)`}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', padding: '32px' }}>暂无工具调用记录</div>
        )}
      </div>
    </div>
  )
}
