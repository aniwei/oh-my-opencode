// 资源加载器测试
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

import { loadProjectResources, createResourceLoader } from '../src/core/resource-loader'

function createTempProject(): string {
  const dir = join(tmpdir(), `vitamin-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('loadProjectResources', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = createTempProject()
  })

  afterEach(() => {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true })
    }
  })

  describe('#given 空项目目录', () => {
    describe('#when 加载资源', () => {
      it('#then 所有字段为空或 null', async () => {
        const resources = await loadProjectResources(projectDir)

        expect(resources.agentsMd).toBeNull()
        expect(resources.rules).toHaveLength(0)
        expect(resources.plans).toHaveLength(0)
        expect(resources.extensions).toHaveLength(0)
      })
    })
  })

  describe('#given 项目有 AGENTS.md', () => {
    describe('#when 加载资源', () => {
      it('#then agentsMd 包含文件内容', async () => {
        writeFileSync(join(projectDir, 'AGENTS.md'), '# My Project\n\nDescription here.')

        const resources = await loadProjectResources(projectDir)

        expect(resources.agentsMd).toBe('# My Project\n\nDescription here.')
      })
    })
  })

  describe('#given 项目有 .rules/*.md', () => {
    describe('#when 有两个 rule 文件', () => {
      it('#then rules 数组包含两项', async () => {
        const rulesDir = join(projectDir, '.rules')
        mkdirSync(rulesDir)
        writeFileSync(join(rulesDir, 'style.md'), 'Use 2-space indent')
        writeFileSync(join(rulesDir, 'naming.md'), 'Use kebab-case')

        const resources = await loadProjectResources(projectDir)

        expect(resources.rules).toHaveLength(2)
        expect(resources.rules).toContain('Use 2-space indent')
        expect(resources.rules).toContain('Use kebab-case')
      })
    })

    describe('#when .rules 目录包含非 .md 文件', () => {
      it('#then 忽略非 .md 文件', async () => {
        const rulesDir = join(projectDir, '.rules')
        mkdirSync(rulesDir)
        writeFileSync(join(rulesDir, 'style.md'), 'Rule content')
        writeFileSync(join(rulesDir, 'config.json'), '{}')

        const resources = await loadProjectResources(projectDir)

        expect(resources.rules).toHaveLength(1)
        expect(resources.rules[0]).toBe('Rule content')
      })
    })
  })

  describe('#given 项目有 .vitamin/plans/*.md', () => {
    describe('#when 有计划文件', () => {
      it('#then plans 包含内容', async () => {
        const plansDir = join(projectDir, '.vitamin', 'plans')
        mkdirSync(plansDir, { recursive: true })
        writeFileSync(join(plansDir, 'refactor.md'), '# Refactor Plan')

        const resources = await loadProjectResources(projectDir)

        expect(resources.plans).toHaveLength(1)
        expect(resources.plans[0]).toBe('# Refactor Plan')
      })
    })
  })

  describe('#given 项目有 .vitamin/extensions/', () => {
    describe('#when 有扩展路径', () => {
      it('#then extensions 包含路径', async () => {
        const extDir = join(projectDir, '.vitamin', 'extensions')
        mkdirSync(extDir, { recursive: true })
        writeFileSync(join(extDir, 'my-ext.js'), '// ext')

        const resources = await loadProjectResources(projectDir)

        expect(resources.extensions).toHaveLength(1)
        expect(resources.extensions[0]).toContain('my-ext.js')
      })
    })
  })
})

describe('createResourceLoader', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = createTempProject()
  })

  afterEach(() => {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true })
    }
  })

  describe('#given 资源加载器', () => {
    describe('#when 调用 load()', () => {
      it('#then 等同于 loadProjectResources', async () => {
        writeFileSync(join(projectDir, 'AGENTS.md'), '# Test')

        const loader = createResourceLoader(projectDir)
        const resources = await loader.load()

        expect(resources.agentsMd).toBe('# Test')
      })
    })

    describe('#when 调用 loadAgentsMd()', () => {
      it('#then 单独返回 AGENTS.md 内容', async () => {
        writeFileSync(join(projectDir, 'AGENTS.md'), '# Only AGENTS')

        const loader = createResourceLoader(projectDir)
        const agentsMd = await loader.loadAgentsMd()

        expect(agentsMd).toBe('# Only AGENTS')
      })
    })

    describe('#when 调用 loadRules()', () => {
      it('#then 单独返回 rules', async () => {
        const rulesDir = join(projectDir, '.rules')
        mkdirSync(rulesDir)
        writeFileSync(join(rulesDir, 'test.md'), 'Test rule')

        const loader = createResourceLoader(projectDir)
        const rules = await loader.loadRules()

        expect(rules).toHaveLength(1)
        expect(rules[0]).toBe('Test rule')
      })
    })
  })
})
