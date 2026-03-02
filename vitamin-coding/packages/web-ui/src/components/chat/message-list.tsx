import { Box } from '@mantine/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../types/message'
import { MessageBubble } from './message-bubble'

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList(props: MessageListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: props.messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 10,
  })

  useEffect(() => {
    if (props.messages.length === 0) {
      return
    }

    rowVirtualizer.scrollToIndex(props.messages.length - 1)
  }, [props.messages.length, rowVirtualizer])

  return (
    <Box ref={parentRef} style={{ overflow: 'auto', height: 'calc(100vh - 260px)' }}>
      <Box style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const message = props.messages[virtualItem.index]
          if (!message) {
            return null
          }

          return (
            <Box
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: 8,
              }}
            >
              <MessageBubble message={message} />
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
