import React, { useEffect, useState } from 'react'

export const SessionExplorer: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([])
  
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data)
    } catch (e) {
      console.error('Failed to fetch sessions', e)
    }
  }

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Session Explorer</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {sessions.map(s => (
          <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f9f9' }}>
            <span><strong style={{ fontFamily: 'monospace' }}>{s.id}</strong></span>
            <span style={{ 
              backgroundColor: s.status === 'active' ? '#e6f4ea' : '#f5f5f5', 
              color: s.status === 'active' ? '#1e8e3e' : '#666',
              padding: '2px 8px', borderRadius: '12px', fontSize: '12px' 
            }}>{s.status.toUpperCase()}</span>
          </li>
        ))}
        {sessions.length === 0 && <li style={{ padding: '8px 0', color: '#999' }}>No active sessions</li>}
      </ul>
    </div>
  )
}