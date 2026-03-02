import { Group, Stack } from '@mantine/core'
import { useCallback, useState } from 'react'
import type { Attachment } from '../../types/message'
import { useDraftStore } from '../../stores/draft-store'
import { useSettingsStore } from '../../stores/settings-store'
import { AttachmentPreview } from './attachment-preview'
import { CommandPalette } from './command-palette'
import { FileUpload } from './file-upload'
import { MessageComposer } from './message-composer'
import { SendButton } from './send-button'

interface ChatInputProps {
  sessionId: string
  sending: boolean
  onSend: (content: string) => Promise<void>
}

export function ChatInput(props: ChatInputProps) {
  const { sendShortcut } = useSettingsStore()
  const { getDraft, setDraft, clearDraft } = useDraftStore()
  const [showCommands, setShowCommands] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const value = getDraft(props.sessionId)

  const submit = async () => {
    const content = value.trim()
    if (!content) {
      return
    }

    await props.onSend(content)
    clearDraft(props.sessionId)
    setShowCommands(false)
    setAttachments([])
  }

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <Stack gap="xs">
      <CommandPalette
        visible={showCommands}
        filter={value.startsWith('/') ? value : undefined}
        onPick={(command) => {
          if (command) {
            setDraft(props.sessionId, `${command} `)
          }
          setShowCommands(false)
        }}
      />
      <AttachmentPreview attachments={attachments} onRemove={handleRemoveAttachment} />
      {showUpload ? (
        <FileUpload
          onUpload={(newAttachments) => {
            setAttachments((prev) => [...prev, ...newAttachments])
            setShowUpload(false)
          }}
        />
      ) : null}
      <Group align="end" wrap="nowrap">
        <MessageComposer
          value={value}
          onChange={(next) => {
            setDraft(props.sessionId, next)
            setShowCommands(next.startsWith('/'))
          }}
          onKeyDown={(event) => {
            const isEnter = event.key === 'Enter'
            const useCmdEnter = sendShortcut === 'cmd-enter'
              ? event.metaKey
              : !event.shiftKey

            if (isEnter && useCmdEnter) {
              event.preventDefault()
              void submit()
            }
          }}
          onPaste={(event) => {
            const items = event.clipboardData?.items
            if (!items) {
              return
            }

            for (const item of Array.from(items)) {
              if (item.type.startsWith('image/')) {
                event.preventDefault()
                const file = item.getAsFile()
                if (file) {
                  const attachment: Attachment = {
                    name: file.name || 'pasted-image.png',
                    type: 'image',
                    url: URL.createObjectURL(file),
                    size: file.size,
                  }
                  setAttachments((prev) => [...prev, attachment])
                }
              }
            }
          }}
        />
        <SendButton
          loading={props.sending}
          disabled={!value.trim()}
          onClick={() => {
            void submit()
          }}
        />
      </Group>
    </Stack>
  )
}
