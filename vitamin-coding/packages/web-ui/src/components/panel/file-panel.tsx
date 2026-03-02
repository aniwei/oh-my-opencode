import { Divider, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../services/api-client'
import { FileDiffViewer } from './file-diff-viewer'
import { FileDownload } from './file-download'
import { FilePreview } from './file-preview'
import { FileTree } from './file-tree'

interface FileEntry {
  path: string
  size: number
}

interface FileDetail {
  content: string
  diff: string
}

interface FilePanelProps {
  sessionId?: string | null
}

export function FilePanel(props: FilePanelProps) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [detail, setDetail] = useState<FileDetail | null>(null)

  useEffect(() => {
    if (!props.sessionId) {
      return
    }

    let active = true
    apiClient.get<FileEntry[]>(`/api/files/${props.sessionId}`)
      .then((data) => {
        if (active) {
          setFiles(data)
        }
      })
      .catch(() => {
        if (active) {
          setFiles([])
        }
      })

    return () => { active = false }
  }, [props.sessionId])

  useEffect(() => {
    if (!props.sessionId || !selectedPath) {
      setDetail(null)
      return
    }

    let active = true
    apiClient.get<FileDetail>(`/api/files/${props.sessionId}/${encodeURIComponent(selectedPath)}`)
      .then((data) => {
        if (active) {
          setDetail(data)
        }
      })
      .catch(() => {
        if (active) {
          setDetail({ content: '加载失败', diff: '' })
        }
      })

    return () => { active = false }
  }, [props.sessionId, selectedPath])

  const handleDownload = useCallback(() => {
    if (!detail || !selectedPath) {
      return
    }

    const blob = new Blob([detail.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = selectedPath.split('/').pop() ?? 'file.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [detail, selectedPath])

  return (
    <Stack gap="xs">
      <Text fw={700} size="sm">文件面板</Text>
      <FileTree files={files} selectedPath={selectedPath} onSelect={setSelectedPath} />
      <FileDownload enabled={Boolean(detail)} onDownload={handleDownload} />
      <Divider />
      <FilePreview path={selectedPath} content={detail?.content ?? ''} />
      {detail?.diff ? <FileDiffViewer diff={detail.diff} /> : null}
    </Stack>
  )
}
