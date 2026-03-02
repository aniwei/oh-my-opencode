import { useMemo } from 'react'
import { StreamClient } from '../services/stream-client'

export function useStream() {
  return useMemo(() => ({
    readSse: (path: string, body: unknown) => StreamClient.fromSse(path, body),
  }), [])
}
