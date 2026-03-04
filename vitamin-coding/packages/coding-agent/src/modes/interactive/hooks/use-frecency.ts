/**
 * Frecency scoring — combines frequency and recency to rank items.
 * Score = frequency * recencyWeight, where recencyWeight decays over time.
 */

interface FrecencyEntry {
  key: string
  count: number
  lastUsed: number
}

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000 // 1 week

function recencyWeight(lastUsed: number, now: number): number {
  const age = now - lastUsed
  return Math.pow(2, -age / HALF_LIFE_MS)
}

function score(entry: FrecencyEntry, now: number): number {
  return entry.count * recencyWeight(entry.lastUsed, now)
}

export interface FrecencyStore {
  record: (key: string) => void
  sort: <T>(items: T[], keyFn: (item: T) => string) => T[]
  getScore: (key: string) => number
}

/**
 * Creates a frecency store with in-memory tracking.
 */
export function createFrecencyStore(initial: FrecencyEntry[] = []): FrecencyStore {
  const entries = new Map<string, FrecencyEntry>()

  for (const entry of initial) {
    entries.set(entry.key, entry)
  }

  function record(key: string): void {
    const now = Date.now()
    const existing = entries.get(key)
    if (existing) {
      existing.count += 1
      existing.lastUsed = now
    } else {
      entries.set(key, { key, count: 1, lastUsed: now })
    }
  }

  function getScore(key: string): number {
    const entry = entries.get(key)
    if (!entry) return 0
    return score(entry, Date.now())
  }

  function sort<T>(items: T[], keyFn: (item: T) => string): T[] {
    const now = Date.now()
    return [...items].sort((a, b) => {
      const entryA = entries.get(keyFn(a))
      const entryB = entries.get(keyFn(b))
      const scoreA = entryA ? score(entryA, now) : 0
      const scoreB = entryB ? score(entryB, now) : 0
      return scoreB - scoreA
    })
  }

  return { record, sort, getScore }
}

import { useState, useRef } from 'react'

/**
 * React hook wrapping a frecency store.
 */
export function useFrecency(initial: FrecencyEntry[] = []) {
  const storeRef = useRef(createFrecencyStore(initial))
  const [, setTick] = useState(0)

  function record(key: string) {
    storeRef.current.record(key)
    setTick((t) => t + 1)
  }

  function sort<T>(items: T[], keyFn: (item: T) => string): T[] {
    return storeRef.current.sort(items, keyFn)
  }

  function getScore(key: string): number {
    return storeRef.current.getScore(key)
  }

  return { record, sort, getScore }
}
