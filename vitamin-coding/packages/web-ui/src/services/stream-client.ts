import type { StreamEvent } from '../types/api'

type StreamMessage = {
  event: string
  data: string
}

export class StreamClient {
  static async *fromSse(path: string, body: unknown): AsyncGenerator<StreamEvent> {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok || !response.body) {
      throw new Error(`SSE request failed: ${response.status}`)
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += value
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const parsed = parseSseChunk(part)
        if (!parsed) {
          continue
        }

        const data = safeJsonParse(parsed.data)
        yield {
          type: parsed.event as StreamEvent['type'],
          data,
        }
      }
    }
  }
}

function parseSseChunk(chunk: string): StreamMessage | null {
  const lines = chunk.split('\n')
  let event = 'message'
  let data = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    }
    if (line.startsWith('data:')) {
      data = line.slice('data:'.length).trim()
    }
  }

  if (!data) {
    return null
  }

  return { event, data }
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}
