// 系统 Prompt 构建测试（验收 4.2.11）
import { buildSystemPrompt, buildSystemPromptLayers } from '../src/core/system-prompt'

import type { AgentPromptMetadata, AgentRegistration } from '@vitamin/orchestrator'

// 创建 mock AgentRegistry
function createMockAgentRegistry(agents: AgentRegistration[] = []) {
  return {
    getAvailable: () => agents,
    getAll: () => agents,
    get: (name: string) => agents.find((a) => a.name === name),
    find: (name: string) => agents.find((a) => a.name === name),
    has: (name: string) => agents.some((a) => a.name === name),
  } as unknown as import('@vitamin/orchestrator').AgentRegistry
}

// 创建 mock ToolRegistry
function createMockToolRegistry(tools: Array<{ name: string; description: string }> = []) {
  return {
    getAll: () =>
      tools.map((t) => ({
        ...t,
        parameters: {},
        execute: async () => ({ content: '' }),
        metadata: { preset: 'standard', builtin: true },
      })),
    getAvailable: () => [],
  } as unknown as import('@vitamin/tools').ToolRegistry
}

const defaultMetadata: AgentPromptMetadata = {
  category: 'orchestrator',
  cost: 'EXPENSIVE',
  triggers: [{ domain: 'general', trigger: 'coding tasks' }],
  executionMode: 'sync',
}

function makeAgent(
  name: string,
  mode: 'primary' | 'subagent' | 'all' = 'primary',
): AgentRegistration {
  return {
    name,
    factory: (() => undefined) as never,
    mode,
    metadata: defaultMetadata,
    modelPriority: ['anthropic/claude-sonnet'],
    disableable: true,
    enabled: true,
  }
}

describe('buildSystemPromptLayers', () => {
  describe('#given 空注册表和空资源', () => {
    describe('#when 构建各层', () => {
      it('#then identity 层包含身份描述', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.identity).toContain('Vitamin')
        expect(layers.identity).toContain('AI coding assistant')
      })

      it('#then delegationTable 为空', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.delegationTable).toBe('')
      })

      it('#then toolList 为空', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.toolList).toBe('')
      })

      it('#then projectContext 为空', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.projectContext).toBe('')
      })
    })
  })

  // 验收 4.2.11: 系统提示含项目上下文（AGENTS.md 内容）
  describe('#given 资源包含 AGENTS.md', () => {
    describe('#when 构建 projectContext 层', () => {
      it('#then 包含 AGENTS.md 内容（4.2.11）', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const agentsMdContent =
          '# Project Overview\n\nThis is a TypeScript monorepo with 13 packages.'
        const resources = { agentsMd: agentsMdContent, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.projectContext).toContain('AGENTS.md')
        expect(layers.projectContext).toContain('Project Overview')
        expect(layers.projectContext).toContain('TypeScript monorepo')
      })
    })
  })

  describe('#given 资源包含 rules', () => {
    describe('#when 构建 projectContext 层', () => {
      it('#then 包含 rules 内容', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const resources = {
          agentsMd: null,
          rules: ['Rule 1: Always use TypeScript strict mode', 'Rule 2: No any type'],
          plans: [],
          extensions: [],
        }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.projectContext).toContain('Rules')
        expect(layers.projectContext).toContain('strict mode')
        expect(layers.projectContext).toContain('No any type')
      })
    })
  })

  describe('#given 注册了多个工具', () => {
    describe('#when 构建 toolList 层', () => {
      it('#then 包含工具名和描述', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry([
          { name: 'read_file', description: 'Read file contents' },
          { name: 'write_file', description: 'Write content to file' },
          { name: 'search', description: 'Search codebase' },
        ])
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.toolList).toContain('read_file')
        expect(layers.toolList).toContain('write_file')
        expect(layers.toolList).toContain('search')
        expect(layers.toolList).toContain('Read file contents')
      })
    })
  })

  describe('#given 注册了 Agent', () => {
    describe('#when 构建 delegationTable 层', () => {
      it('#then 委派表非空', () => {
        const agents = [makeAgent('central-secretariat'), makeAgent('oracle', 'subagent')]
        const agentReg = createMockAgentRegistry(agents)
        const toolReg = createMockToolRegistry()
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources)

        expect(layers.delegationTable.length).toBeGreaterThan(0)
      })
    })
  })

  describe('#given activeSkills 选项', () => {
    describe('#when 提供 activeSkills 列表', () => {
      it('#then activeSkills 层包含 skill 名称', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const layers = buildSystemPromptLayers(agentReg, toolReg, resources, {
          activeSkills: ['docker-compose', 'prisma'],
        })

        expect(layers.activeSkills).toContain('docker-compose')
        expect(layers.activeSkills).toContain('prisma')
      })
    })
  })
})

describe('buildSystemPrompt', () => {
  describe('#given 完整资源', () => {
    describe('#when 构建系统 Prompt', () => {
      it('#then 各层之间用分隔线连接', () => {
        const agents = [makeAgent('central-secretariat')]
        const agentReg = createMockAgentRegistry(agents)
        const toolReg = createMockToolRegistry([{ name: 'read_file', description: 'Read files' }])
        const resources = { agentsMd: '# Project', rules: ['Rule 1'], plans: [], extensions: [] }

        const prompt = buildSystemPrompt(agentReg, toolReg, resources)

        expect(prompt).toContain('---')
        expect(prompt).toContain('Vitamin')
        expect(prompt).toContain('read_file')
        expect(prompt).toContain('Project')
      })
    })
  })

  describe('#given 空资源', () => {
    describe('#when 没有项目上下文', () => {
      it('#then 仍包含身份层', () => {
        const agentReg = createMockAgentRegistry()
        const toolReg = createMockToolRegistry()
        const resources = { agentsMd: null, rules: [], plans: [], extensions: [] }

        const prompt = buildSystemPrompt(agentReg, toolReg, resources)

        expect(prompt).toContain('Vitamin')
      })
    })
  })
})
