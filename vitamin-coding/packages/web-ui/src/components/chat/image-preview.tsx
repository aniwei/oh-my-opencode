import { Image, Modal } from '@mantine/core'
import { useState } from 'react'

interface ImagePreviewProps {
  src: string
  alt: string
  maxHeight?: number
}

export function ImagePreview(props: ImagePreviewProps) {
  const [opened, setOpened] = useState(false)

  return (
    <>
      <Image
        src={props.src}
        alt={props.alt}
        mah={props.maxHeight ?? 300}
        fit="contain"
        radius="md"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpened(true)}
      />
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        size="xl"
        padding={0}
        withCloseButton
        title={props.alt}
      >
        <Image src={props.src} alt={props.alt} fit="contain" />
      </Modal>
    </>
  )
}
