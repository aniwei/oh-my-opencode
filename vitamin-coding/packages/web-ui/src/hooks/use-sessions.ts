import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../services/session-api'
import type { SessionSummary } from '../types/api'

const SESSION_QUERY_KEY = ['sessions'] as const

export function useSessions() {
  const queryClient = useQueryClient()

  const { data: sessions = [], isLoading: loading, refetch } = useQuery<SessionSummary[]>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => sessionApi.list(),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (title?: string) => sessionApi.create(title),
    onSuccess: (created) => {
      queryClient.setQueryData<SessionSummary[]>(SESSION_QUERY_KEY, (prev) =>
        [created, ...(prev ?? [])],
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (sessionId: string) => sessionApi.remove(sessionId),
    onSuccess: (_result, sessionId) => {
      queryClient.setQueryData<SessionSummary[]>(SESSION_QUERY_KEY, (prev) =>
        (prev ?? []).filter((item) => item.id !== sessionId),
      )
    },
  })

  const refresh = useCallback(() => {
    void refetch()
  }, [refetch])

  const createSession = useCallback(async (title?: string) => {
    return createMutation.mutateAsync(title)
  }, [createMutation])

  const removeSession = useCallback(async (sessionId: string) => {
    return removeMutation.mutateAsync(sessionId)
  }, [removeMutation])

  return {
    sessions,
    loading,
    refresh,
    createSession,
    removeSession,
  }
}
