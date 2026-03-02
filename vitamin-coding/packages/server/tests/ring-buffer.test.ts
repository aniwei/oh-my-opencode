import { describe, expect, it } from 'vitest'
import { RingBuffer } from '../src/ring-buffer'

describe('RingBuffer', () => {
  it('should push and toArray correctly', () => {
    const rb = new RingBuffer<number>(3)
    rb.push(1)
    rb.push(2)
    expect(rb.toArray()).toEqual([1, 2])
    rb.push(3)
    expect(rb.toArray()).toEqual([1, 2, 3])
    rb.push(4)
    expect(rb.toArray()).toEqual([2, 3, 4])
  })
})
