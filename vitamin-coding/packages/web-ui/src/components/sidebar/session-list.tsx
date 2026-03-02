import { Box, Stack } from '@mantine/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef } from 'react'
import type { SessionSummary } from '../../types/api'
import { SessionGroup } from './session-group'
import { SessionItem } from './session-item'

type Row =
  | { type: 'group'; title: string }
  | { type: 'session'; item: SessionSummary }

function groupTitle(updatedAt: number): string {
  const now = new Date()
  const target = new Date(updatedAt)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000

  if (updatedAt >= startOfToday) {
    return '今天'
  }

  if (updatedAt >= startOfYesterday) {
    return '昨天'
  }

  if (updatedAt >= startOfWeek) {
    return '最近 7 天'
  }

  if (target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth()) {
    return '本月更早'
  }

  return '更早'
}

function flattenRows(sessions: SessionSummary[]): Row[] {
  const rows: Row[] = []
  let lastGroup = ''

  for (const session of sessions) {
    const group = groupTitle(session.updatedAt)
    if (group !== lastGroup) {
      rows.push({ type: 'group', title: group })
      lastGroup = group
    }

    rows.push({ type: 'session', item: session })
  }

  return rows
}

interface SessionListProps {
  sessions: SessionSummary[]
  activeSessionId: string | null
  onSelect: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export function SessionList(props: SessionListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const rows = useMemo(() => flattenRows(props.sessions), [props.sessions])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index]?.type === 'group' ? 28 : 68,
    overscan: 10,
  })

  const items = rowVirtualizer.getVirtualItems()

  return (
    <Box ref={parentRef} style={{ height: 'calc(100vh - 230px)', overflow: 'auto' }}>
      <Box style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {items.map((virtualItem) => {
          const row = rows[virtualItem.index]
          if (!row) {
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
              }}
            >
              {row.type === 'group' ? (
                <SessionGroup title={row.title} />
              ) : (
                <Stack gap={4}>
                  <SessionItem
                    session={row.item}
                    active={row.item.id === props.activeSessionId}
                    onSelect={props.onSelect}
                    onDelete={props.onDelete}
                  />
                </Stack>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
