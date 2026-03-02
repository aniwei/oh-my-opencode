export class RingBuffer<T> {
  private buffer: T[]
  private head = 0
  private tail = 0
  private count = 0

  constructor(public readonly capacity: number) {
    this.buffer = new Array<T>(capacity)
  }

  push(item: T) {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    if (this.count < this.capacity) {
      this.count++
    } else {
      this.head = (this.head + 1) % this.capacity
    }
  }

  toArray(): T[] {
    const result = new Array<T>(this.count)
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[(this.head + i) % this.capacity]
      if (item !== undefined) {
        result[i] = item
      }
    }
    return result
  }
}
