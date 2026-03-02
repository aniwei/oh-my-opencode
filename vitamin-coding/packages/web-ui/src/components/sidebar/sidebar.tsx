import { Stack } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessions } from '../../hooks/use-sessions'
import { NewChatButton } from './new-chat-button'
import { SearchInput } from './search-input'
import { SessionList } from './session-list'

interface SidebarProps {
  activeSessionId: string | null
}

export function Sidebar(props: SidebarProps) {
  const navigate = useNavigate()
  const { sessions, createSession, removeSession } = useSessions()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return sessions
    }

    const normalized = query.trim().toLowerCase()
    return sessions.filter((session) => session.title.toLowerCase().includes(normalized))
  }, [query, sessions])

  return (
    <Stack gap="sm">
      <NewChatButton
        onCreate={async () => {
          const created = await createSession('新对话')
          navigate(`/app/chat/${created.id}`)
        }}
      />
      <SearchInput value={query} onChange={setQuery} />
      <SessionList
        sessions={filtered}
        activeSessionId={props.activeSessionId}
        onSelect={(sessionId) => navigate(`/app/chat/${sessionId}`)}
        onDelete={(sessionId) => {
          void removeSession(sessionId)
        }}
      />
    </Stack>
  )
}
