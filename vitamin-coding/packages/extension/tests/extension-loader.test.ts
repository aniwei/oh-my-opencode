// Extension 加载器测试
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, afterEach } from 'vitest'

import { createExtensionLoader } from '../src/extension-loader'

describe('ExtensionLoader', () => {
  // 临时目录清理
  const tempDirs: string[] = []

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'ext-loader-'))
    tempDirs.push(dir)
    return dir
  }

  describe('#given 配置了内置扩展目录', () => {
    describe('#when 目录下有 Extension 文件', () => {
      it('#then 可发现目录型 Extension (index.ts)', async () => {
        const builtinDir = await createTempDir()
        const extDir = join(builtinDir, 'my-ext')
        await mkdir(extDir)
        await writeFile(join(extDir, 'index.ts'), 'export default () => {}')

        const loader = createExtensionLoader({ builtinDir })
        const descriptors = await loader.discover()

        expect(descriptors).toHaveLength(1)
        expect(descriptors[0]?.name).toBe('my-ext')
        expect(descriptors[0]?.source).toBe('builtin')
      })

      it('#then 可发现单文件 Extension', async () => {
        const builtinDir = await createTempDir()
        await writeFile(join(builtinDir, 'simple.ts'), 'export default () => {}')

        const loader = createExtensionLoader({ builtinDir })
        const descriptors = await loader.discover()

        expect(descriptors).toHaveLength(1)
        expect(descriptors[0]?.name).toBe('simple')
        expect(descriptors[0]?.source).toBe('builtin')
      })
    })

    describe('#when 目录不存在', () => {
      it('#then 返回空数组不抛出', async () => {
        const loader = createExtensionLoader({ builtinDir: '/nonexistent/path' })
        const descriptors = await loader.discover()
        expect(descriptors).toHaveLength(0)
      })
    })
  })

  describe('#given 配置了本地扩展目录', () => {
    describe('#when 目录下有 Extension', () => {
      it('#then 来源标记为 local', async () => {
        const localDir = await createTempDir()
        await writeFile(join(localDir, 'local-ext.js'), 'module.exports = () => {}')

        const loader = createExtensionLoader({ localDir })
        const descriptors = await loader.discover()

        expect(descriptors).toHaveLength(1)
        expect(descriptors[0]?.name).toBe('local-ext')
        expect(descriptors[0]?.source).toBe('local')
      })
    })
  })

  describe('#given 配置了路径数组', () => {
    describe('#when 路径有效', () => {
      it('#then 来源标记为 config', async () => {
        const dir = await createTempDir()
        const extPath = join(dir, 'config-ext.ts')
        await writeFile(extPath, 'export default () => {}')

        const loader = createExtensionLoader({ configPaths: [extPath] })
        const descriptors = await loader.discover()

        expect(descriptors).toHaveLength(1)
        expect(descriptors[0]?.name).toBe('config-ext')
        expect(descriptors[0]?.source).toBe('config')
      })
    })

    describe('#when 路径无效', () => {
      it('#then 跳过无效路径', async () => {
        const loader = createExtensionLoader({
          configPaths: ['/invalid/nonexistent.ts'],
        })
        const descriptors = await loader.discover()
        expect(descriptors).toHaveLength(0)
      })
    })
  })

  describe('#given 多来源组合（验收 3.2.5）', () => {
    describe('#when 同时配置 builtin + local + config', () => {
      it('#then discover() 返回所有来源的 Extension', async () => {
        const builtinDir = await createTempDir()
        const localDir = await createTempDir()
        const configDir = await createTempDir()

        await writeFile(join(builtinDir, 'a.ts'), 'export default () => {}')
        await writeFile(join(localDir, 'b.ts'), 'export default () => {}')
        const configPath = join(configDir, 'c.ts')
        await writeFile(configPath, 'export default () => {}')

        const loader = createExtensionLoader({
          builtinDir,
          localDir,
          configPaths: [configPath],
        })

        const descriptors = await loader.discover()

        expect(descriptors).toHaveLength(3)

        const sources = descriptors.map((d) => d.source)
        expect(sources).toContain('builtin')
        expect(sources).toContain('local')
        expect(sources).toContain('config')
      })
    })
  })
})
