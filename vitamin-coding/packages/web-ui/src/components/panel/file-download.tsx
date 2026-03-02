import { Button } from '@mantine/core'

interface FileDownloadProps {
  enabled: boolean
  onDownload: () => void
}

export function FileDownload(props: FileDownloadProps) {
  return (
    <Button disabled={!props.enabled} onClick={props.onDownload} size="xs" variant="default">
      下载文件
    </Button>
  )
}
