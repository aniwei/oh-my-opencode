import React, { useEffect, useState } from 'react'

export const AgentMonitor: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([])
  
  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      setAgents(data)
    } catch (e) {
      console.error('Failed to fetch agents', e)
    }
  }

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Agent Monitor</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        {agents.map(a => (
          <div key={a.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong>{a.name || a.id}</strong>
              <span style={{ 
                backgroundColor: a.state === 'streaming' || a.state === 'tool_executing' ? '#e8f0fe' : '#f5f5f5', 
                color: a.state === 'streaming' || a.state === 'tool_executing' ? '#1967d2' : '#666',
                padding: '2px 8px', borderRadius: '12px', fontSize: '12px' 
              }}>{a.state || 'idle'}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#555' }}>
              Type: {a.type}
            </div>
          </div>
        ))}
        {agents.length === 0 && <div style={{ color: '#999' }}>No active agents</div>}
      </div>
    </div>
  )
}