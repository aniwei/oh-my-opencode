// JSONL 追加写入存储
// 每条消息一行 JSON，追加写入，每条 append 后 fsync（断电安全）
import { mkdir, readFile, rm, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { openSync, fsyncSync, writeSync, closeSync } from 'node:fs'

import { createLogger, exists } from '@vitamin/shared'

import type { SessionEntry, SessionStorage } from '../types'

const log = createLogger('session:jsonl-storage')

// JSONL 存储实现
// 文件路径: {baseDir}/{sessionId}.jsonl
export class JsonlStorage implements SessionStorage {
  constructor(private readonly baseDir: string) {}

  async append(sessionId: string, entry: SessionEntry): Promise<void> {
    const filePath = this.filePath(sessionId)
    await this.ensureDir(filePath)

    const line = JSON.stringify(entry) + '\n'

    // 使用同步 fsync 确保断电安全
    const fd = openSync(filePath, 'a')
    try {
      writeSync(fd, line)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
  }

  async readAll(sessionId: string): Promise<SessionEntry[]> {
    const filePath = this.filePath(sessionId)
    const fileExists = await exists(filePath)
    if (!fileExists) {
      return []
    }

    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim().length > 0)
    const entries: SessionEntry[] = []

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as SessionEntry)
      } catch (error) {
        log.warn(`跳过损坏的 JSONL 行: ${line.slice(0, 100)}`)
      }
    }

    return entries
  }

  async exists(sessionId: string): Promise<boolean> {
    return exists(this.filePath(sessionId))
  }

  async remove(sessionId: string): Promise<void> {
    const filePath = this.filePath(sessionId)
    const fileExists = await exists(filePath)
    if (fileExists) {
      await rm(filePath)
    }
  }

  async listSessionIds(): Promise<string[]> {
    const dirExists = await exists(this.baseDir)
    if (!dirExists) {
      return []
    }

    const files = await readdir(this.baseDir)
    return files
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => f.replace('.jsonl', ''))
  }

  private filePath(sessionId: string): string {
    return join(this.baseDir, `${sessionId}.jsonl`)
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath)
    const dirExists = await exists(dir)
    if (!dirExists) {
      await mkdir(dir, { recursive: true })
    }
  }
}

// 工厂函数
export function createJsonlStorage(baseDir: string): JsonlStorage {
  return new JsonlStorage(baseDir)
}
