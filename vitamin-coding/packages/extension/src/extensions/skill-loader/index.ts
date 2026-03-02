// skill-loader Extension — Skill 系统加载器（§S9, 5.2.3）
// 从 SKILL.md 加载 Skill 定义并注入上下文

import { fileURLToPath } from 'node:url'

import type { ExtensionFactory } from '../../types'

// Skill 定义结构
export interface SkillDefinition {
  name: string
  description: string
  content: string
  mcpServers?: string[]
  parameters?: Record<string, string>
}

// skill-loader 外部依赖回调接口
export interface SkillLoaderCallbacks {
  // 发现并加载 SKILL.md 文件
  discoverSkills: (searchDirs: string[]) => Promise<SkillDefinition[]>
  // 将 Skill 信息注入到系统上下文
  injectContext: (skills: SkillDefinition[]) => void
  // 启动 Skill 内嵌的 MCP 服务器
  startSkillMcps: (skills: SkillDefinition[]) => Promise<void>
}

// 创建 skill-loader Extension 工厂
export function createSkillLoaderExtension(callbacks: SkillLoaderCallbacks): ExtensionFactory {
  return async (api) => {
    api.log.info('skill-loader Extension 初始化')

    let loadedSkills: SkillDefinition[] = []

    // 监听会话启动事件，自动加载 Skill
    api.on('session.start', async () => {
      try {
        // 从项目目录和用户目录发现 Skill
        const searchDirs = ['.vitamin/skills', '.skills']
        const skills = await callbacks.discoverSkills(searchDirs)

        if (skills.length === 0) {
          api.log.info('未发现 SKILL.md 文件')
          return
        }

        loadedSkills = skills
        api.log.info(`已加载 ${String(skills.length)} 个 Skill: ${skills.map((s) => s.name).join(', ')}`)

        // 注入上下文
        callbacks.injectContext(skills)

        // 启动 Skill 内嵌的 MCP
        const skillsWithMcps = skills.filter(
          (s) => s.mcpServers && s.mcpServers.length > 0,
        )
        if (skillsWithMcps.length > 0) {
          await callbacks.startSkillMcps(skillsWithMcps)
          api.log.info(`已启动 ${String(skillsWithMcps.length)} 个 Skill MCP 服务器`)
        }
      } catch (error) {
        api.log.error(`Skill 加载失败: ${String(error)}`)
      }
    })

    // 资源发现事件回调
    api.on('resources.discover', (event) => {
      if (loadedSkills.length > 0) {
        const skillResources = loadedSkills.map(
          (s) => `skill:${s.name}`,
        )
        event.resources.push(...skillResources)
      }
    })

    // 通过扩展间通信发布 Skill 列表
    api.onBus('skill:list:request', () => {
      api.emit('skill:list:response', {
        skills: loadedSkills.map((s) => ({
          name: s.name,
          description: s.description,
        })),
      })
    })

    api.log.info('skill-loader Extension 初始化完成')
  }
}

// 创建 skill-loader Extension 描述符
export function createSkillLoaderDescriptor(
  callbacks: SkillLoaderCallbacks,
): { name: string; source: 'builtin'; entryPoint: string; factory: ExtensionFactory } {
  return {
    name: 'skill-loader',
    source: 'builtin',
    entryPoint: fileURLToPath(import.meta.url),
    factory: createSkillLoaderExtension(callbacks),
  }
}
