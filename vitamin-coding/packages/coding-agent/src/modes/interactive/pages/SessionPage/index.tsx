import { Box } from 'ink'
import { useParams, useLocation } from 'react-router'
import { useApp } from '../../context/app-context'
import { Header } from './Header'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'
import { MessageList } from './MessageList'
import { Prompt } from '../../components/Prompt/index'

/**
 * Session page — main layout: Header + (Messages + Sidebar) + Prompt + Footer.
 *
 * Data-dependent props (messages, title, cost, etc.) use empty defaults;
 * real data will be wired when the data layer is connected.
 */
export function SessionPage() {
  const { sessionID } = useParams<{ sessionID: string }>()
  const location = useLocation()
  const { state } = useApp()
  const initialPrompt = (location.state as { initialPrompt?: string } | null)
    ?.initialPrompt

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Header
        sessionID={sessionID ?? ''}
        title={initialPrompt ? initialPrompt.slice(0, 60) : 'New Session'}
      />

      {/* Body: Messages + optional Sidebar */}
      <Box flexGrow={1} flexDirection="row">
        {/* Message area */}
        <Box flexDirection="column" flexGrow={1}>
          <MessageList messages={[]} />
        </Box>

        {/* Sidebar */}
        {state.sidebarOpen && (
          <Sidebar sessionID={sessionID ?? ''} />
        )}
      </Box>

      {/* Prompt */}
      <Box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0}>
        <Prompt />
      </Box>

      {/* Footer */}
      <Box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexShrink={0}>
        <Footer />
      </Box>
    </Box>
  )
}
