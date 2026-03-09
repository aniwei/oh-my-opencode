import { useCallback } from 'react'
import { useApp } from '../context/app-context'

/**
 * Scroll control hook — manages scroll lock state via UIState.
 */
export function useScroll() {
  const { state, dispatch } = useApp()

  const lock = useCallback(() => {
    dispatch({ type: 'scroll/lock', locked: true })
  }, [dispatch])

  const unlock = useCallback(() => {
    dispatch({ type: 'scroll/lock', locked: false })
  }, [dispatch])

  const toggle = useCallback(() => {
    dispatch({ type: 'scroll/lock', locked: !state.scrollLocked })
  }, [dispatch, state.scrollLocked])

  return {
    isLocked: state.scrollLocked,
    lock,
    unlock,
    toggle,
  }
}
