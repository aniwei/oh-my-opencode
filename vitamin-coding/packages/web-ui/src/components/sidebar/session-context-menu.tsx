import { Menu, Paper, Text } from '@mantine/core'

interface SessionContextMenuProps {
  sessionId: string
  opened: boolean
  position: { x: number; y: number }
  onClose: () => void
  onRename: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  onArchive: (sessionId: string) => void
  onExport: (sessionId: string) => void
}

export function SessionContextMenu(props: SessionContextMenuProps) {
  if (!props.opened) {
    return null
  }

  return (
    <Paper
      shadow="md"
      radius="md"
      style={{
        position: 'fixed',
        top: props.position.y,
        left: props.position.x,
        zIndex: 1000,
      }}
    >
      <Menu opened shadow="md" width={160} position="bottom-start" onClose={props.onClose}>
        <Menu.Dropdown>
          <Menu.Item onClick={() => props.onRename(props.sessionId)}>
            <Text size="sm">重命名</Text>
          </Menu.Item>
          <Menu.Item onClick={() => props.onArchive(props.sessionId)}>
            <Text size="sm">归档</Text>
          </Menu.Item>
          <Menu.Item onClick={() => props.onExport(props.sessionId)}>
            <Text size="sm">导出 Markdown</Text>
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red" onClick={() => props.onDelete(props.sessionId)}>
            <Text size="sm">删除</Text>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Paper>
  )
}
