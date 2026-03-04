import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import { useMemo, useState } from 'react'

interface FileInfo {
  path: string
  size: number
}

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: TreeNode[]
  size?: number
}

function buildTree(files: FileInfo[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean)
    if (parts.length === 0) continue
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? ''
      const isLast = i === parts.length - 1
      const existing = current.find((node) => node.name === part)

      if (existing) {
        if (isLast) {
          existing.size = file.size
        } else {
          current = existing.children
        }
      } else {
        const node: TreeNode = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          isDirectory: !isLast,
          children: [],
          size: isLast ? file.size : undefined,
        }
        current.push(node)
        if (!isLast) {
          current = node.children
        }
      }
    }
  }

  return root
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

interface TreeNodeComponentProps {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}

function TreeNodeComponent(props: TreeNodeComponentProps) {
  const [expanded, setExpanded] = useState(props.depth < 2)
  const sorted = useMemo(() => sortNodes(props.node.children), [props.node.children])

  return (
    <Box>
      <UnstyledButton
        onClick={() => {
          if (props.node.isDirectory) {
            setExpanded((v) => !v)
          } else {
            props.onSelect(props.node.path)
          }
        }}
        w="100%"
        px={4}
        py={2}
        style={{
          paddingLeft: props.depth * 16 + 4,
          borderRadius: 4,
          background: props.node.path === props.selectedPath ? 'var(--mantine-color-dark-5)' : 'transparent',
        }}
      >
        <Group gap={4} wrap="nowrap">
          <Text size="xs" style={{ width: 14, textAlign: 'center' }}>
            {props.node.isDirectory ? (expanded ? '📂' : '📁') : '📄'}
          </Text>
          <Text size="xs" truncate="end">{props.node.name}</Text>
        </Group>
      </UnstyledButton>
      {props.node.isDirectory && expanded ? (
        <Box>
          {sorted.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              depth={props.depth + 1}
              selectedPath={props.selectedPath}
              onSelect={props.onSelect}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

interface FileTreeProps {
  files: FileInfo[]
  selectedPath?: string | null
  onSelect: (path: string) => void
}

export function FileTree(props: FileTreeProps) {
  const tree = useMemo(() => sortNodes(buildTree(props.files)), [props.files])

  if (props.files.length === 0) {
    return <Text c="dimmed" size="sm">暂无文件</Text>
  }

  return (
    <Box>
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          selectedPath={props.selectedPath ?? null}
          onSelect={props.onSelect}
        />
      ))}
    </Box>
  )
}
