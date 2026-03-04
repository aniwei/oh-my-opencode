import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/app-context.js'

/**
 * Session operations — compact, fork, timeline, undo, redo.
 * These are stub implementations that will be wired to the actual agent session API.
 */
export interface SessionOperations {
  compact: () => void
  fork: (messageIndex?: number) => void
  timeline: () => void
  undo: () => void
  redo: () => void
  rename: (sessionID: string, name: string) => void
  deleteSession: (sessionID: string) => void
  exportTranscript: (sessionID: string) => string
}

export function useSessionOperations(sessionID: string): SessionOperations {
  const { dispatch } = useApp()
  const navigate = useNavigate()

  const compact = useCallback(() => {
    dispatch({
      type: 'toast/show',
      toast: { message: 'Session compacted', type: 'info' },
    })
  }, [dispatch])

  const fork = useCallback(
    (messageIndex?: number) => {
      const newSessionID = crypto.randomUUID()
      dispatch({
        type: 'toast/show',
        toast: {
          message: `Forked session at message ${messageIndex ?? 'latest'}`,
          type: 'info',
        },
      })
      navigate(`/session/${newSessionID}`, {
        state: { forkedFrom: sessionID, forkMessageIndex: messageIndex },
      })
    },
    [dispatch, navigate, sessionID],
  )

  const timeline = useCallback(() => {
    dispatch({
      type: 'toast/show',
      toast: { message: 'Timeline view opened', type: 'info' },
    })
  }, [dispatch])

  const undo = useCallback(() => {
    dispatch({
      type: 'toast/show',
      toast: { message: 'Undo (not yet connected)', type: 'warning' },
    })
  }, [dispatch])

  const redo = useCallback(() => {
    dispatch({
      type: 'toast/show',
      toast: { message: 'Redo (not yet connected)', type: 'warning' },
    })
  }, [dispatch])

  const rename = useCallback(
    (_sessionID: string, name: string) => {
      dispatch({
        type: 'toast/show',
        toast: { message: `Renamed to "${name}"`, type: 'info' },
      })
    },
    [dispatch],
  )

  const deleteSession = useCallback(
    (_sessionID: string) => {
      dispatch({
        type: 'toast/show',
        toast: { message: 'Session deleted', type: 'info' },
      })
      navigate('/')
    },
    [dispatch, navigate],
  )

  const exportTranscript = useCallback((_sessionID: string): string => {
    return '# Session Transcript\n\n(Export not yet connected to agent API)'
  }, [])

  return {
    compact,
    fork,
    timeline,
    undo,
    redo,
    rename,
    deleteSession,
    exportTranscript,
  }
}
