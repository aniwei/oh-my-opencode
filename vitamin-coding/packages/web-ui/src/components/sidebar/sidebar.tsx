import { Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavSidebar } from '@vitamin/ui-kit'
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

  const bottomItems = useMemo(() => [
    {
      id: 'settings',
      label: 'Settings',
      icon: <Text size="sm">{'\u2699'}</Text>,
      onClick: () => navigate('/app/settings'),
    },
  ], [navigate])

  return (
    <NavSidebar
      brand={
        <Text fw={700} size="sm" style={{ userSelect: 'none' }}>
          Vitamin
        </Text>
      }
      primaryAction={
        <NewChatButton
          onCreate={async () => {
            const created = await createSession('New Chat')
            navigate(`/app/chat/${created.id}`)
          }}
        />
      }
      search={<SearchInput value={query} onChange={setQuery} />}
      bottomItems={bottomItems}
    >
      <SessionList
        sessions={filtered}
        activeSessionId={props.activeSessionId}
        onSelect={(sessionId) => navigate(`/app/chat/${sessionId}`)}
        onDelete={(sessionId) => {
          void removeSession(sessionId)
        }}
      />
    </NavSidebar>
  )
}
