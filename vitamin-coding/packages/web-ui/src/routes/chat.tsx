import { useParams } from 'react-router-dom'
import { ChatContainer } from '../components/chat/chat-container'
import { EmptyState } from '../components/common/empty-state'

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  if (!sessionId) {
    return <EmptyState icon="💬" title="请选择会话" description="从左侧栏选择或新建一个对话" />
  }

  return <ChatContainer sessionId={sessionId} />
}
