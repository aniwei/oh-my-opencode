import { Box, Text } from '@mantine/core'
import { useCallback, useRef, useState } from 'react'
import type { Attachment } from '../../types/message'

interface FileUploadProps {
  onUpload: (attachments: Attachment[]) => void
  maxFiles?: number
}

function fileToAttachment(file: File): Attachment {
  const isImage = file.type.startsWith('image/')
  return {
    name: file.name,
    type: isImage ? 'image' : 'file',
    url: URL.createObjectURL(file),
    size: file.size,
  }
}

export function FileUpload(props: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const maxFiles = props.maxFiles ?? 10

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    const limited = Array.from(files).slice(0, maxFiles)
    props.onUpload(limited.map(fileToAttachment))
  }, [maxFiles, props.onUpload])

  return (
    <Box
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        handleFiles(event.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-default-border)'}`,
        borderRadius: 8,
        padding: 12,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 200ms',
      }}
    >
      <Text c="dimmed" size="xs">
        {dragging ? '松开以上传文件' : '拖放文件或点击上传'}
      </Text>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => handleFiles(event.target.files)}
      />
    </Box>
  )
}
