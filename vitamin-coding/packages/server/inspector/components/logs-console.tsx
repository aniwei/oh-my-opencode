import React, { useEffect, useState, useRef } from 'react'

export const LogsConsole: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([])
  const [connected, setConnected] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initial fetch
    fetch('/api/logs?since=0')
      .then(r => r.json())
      .then(data => {
        setLogs(data)
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .catch(e => console.error('Failed to fetch initial logs:', e))

    // Set up SSE
    const es = new EventSource('/api/logs/stream?level=debug')
    
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    
    es.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data)
        setLogs(prev => [...prev, log].slice(-1000)) // Keep last 1000
        // Auto scroll if near bottom
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50)
      } catch (err) {
        console.error('Failed to parse log event', err)
      }
    })

    return () => {
      es.close()
    }
  }, [])

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'error': case 'fatal': return '#d93025'
      case 'warn': return '#f29900'
      case 'info': return '#1e8e3e'
      case 'debug': return '#1a73e8'
      case 'trace': return '#80868b'
      default: return '#5f6368'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px' }}>
        <h2 style={{ fontSize: '16px', margin: 0 }}>Logs Console</h2>
        <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: connected ? '#1e8e3e' : '#d93025' }}></span>
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '8px', borderRadius: '4px' }}>
        {logs.map((log, i) => (
          <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid #333', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <span style={{ color: '#858585', marginRight: '8px' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span style={{ color: getLevelColor(log.level), display: 'inline-block', width: '40px', fontWeight: 'bold' }}>{log.level.toUpperCase()}</span>
            <span style={{ color: '#569cd6', marginRight: '8px' }}>[{log.source}]</span>
            <span style={{ color: '#ce9178' }}>{log.message}</span>
            {Object.keys(log).length > 4 && (
               <span style={{ color: '#9cdcfe', marginLeft: '8px' }}>
                 {JSON.stringify(Object.fromEntries(Object.entries(log).filter(([k]) => !['timestamp', 'level', 'source', 'message'].includes(k))))}
               </span>
            )}
          </div>
        ))}
        {logs.length === 0 && <div style={{ color: '#858585', fontStyle: 'italic' }}>Waiting for logs...</div>}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}