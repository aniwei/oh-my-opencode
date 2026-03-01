// Phase 5.2c — 内置 Extension 测试 (5.2.2, 5.2.3, 5.2.4, 5.2.5)
import { describe, expect, it } from 'vitest'

import { createExtensionRunner } from '../src/extension-runner'
import {
  createPlanModeExtension,
  createPlanModeDescriptor,
} from '../src/extensions/plan-mode'
import {
  createSkillLoaderExtension,
  createSkillLoaderDescriptor,
} from '../src/extensions/skill-loader'
import {
  createGitMasterExtension,
  createGitMasterDescriptor,
} from '../src/extensions/git-master'
import {
  createTmuxManagerExtension,
  createTmuxManagerDescriptor,
  parseTmuxSessions,
} from '../src/extensions/tmux-manager'

import type { ExtensionAPI, ExtensionDescriptor } from '../src/types'

// 创建内联 descriptor
function inlineDescriptor(
  name: string,
  factory: (api: ExtensionAPI) => void | Promise<void>,
): ExtensionDescriptor {
  return { name, source: 'builtin', entryPoint: 'inline', factory }
}

describe('builtin extensions', () => {
  // 5.2.2: plan-mode Extension 注册 /plan + /start-work 命令
  describe('plan-mode', () => {
    describe('#given plan-mode Extension loaded', () => {
      describe('#when loaded into runner', () => {
        it('#then registers /plan and /start-work commands (5.2.2)', async () => {
          const runner = createExtensionRunner()
          const callbacks = {
            createPlan: async () => ({ success: true, planName: 'test-plan' }),
            startWork: async () => ({ success: true }),
            listPlans: async () => ['plan-a', 'plan-b'],
          }

          const descriptor = createPlanModeDescriptor(callbacks)
          const results = await runner.loadAll([descriptor])

          expect(results).toHaveLength(1)
          expect(results[0]?.loaded).toBe(true)

          const registry = runner.getRegistry()
          expect(registry.commands.has('plan')).toBe(true)
          expect(registry.commands.has('start-work')).toBe(true)
        })
      })

      describe('#when /plan command is executed with description', () => {
        it('#then calls createPlan callback', async () => {
          let calledWith = ''
          const runner = createExtensionRunner()
          const callbacks = {
            createPlan: async (desc: string) => {
              calledWith = desc
              return { success: true, planName: 'my-plan' }
            },
            startWork: async () => ({ success: true }),
            listPlans: async () => [],
          }

          await runner.loadAll([createPlanModeDescriptor(callbacks)])
          const planCmd = runner.getRegistry().commands.get('plan')
          await planCmd?.execute('build a new feature')

          expect(calledWith).toBe('build a new feature')
        })
      })

      describe('#when /plan list is executed', () => {
        it('#then calls listPlans callback', async () => {
          let listCalled = false
          const runner = createExtensionRunner()
          const callbacks = {
            createPlan: async () => ({ success: true }),
            startWork: async () => ({ success: true }),
            listPlans: async () => {
              listCalled = true
              return ['p1', 'p2']
            },
          }

          await runner.loadAll([createPlanModeDescriptor(callbacks)])
          const planCmd = runner.getRegistry().commands.get('plan')
          await planCmd?.execute('list')

          expect(listCalled).toBe(true)
        })
      })

      describe('#when /start-work is executed', () => {
        it('#then calls startWork callback with plan name', async () => {
          let calledPlan = ''
          const runner = createExtensionRunner()
          const callbacks = {
            createPlan: async () => ({ success: true }),
            startWork: async (name: string) => {
              calledPlan = name
              return { success: true }
            },
            listPlans: async () => [],
          }

          await runner.loadAll([createPlanModeDescriptor(callbacks)])
          const startCmd = runner.getRegistry().commands.get('start-work')
          await startCmd?.execute('my-plan')

          expect(calledPlan).toBe('my-plan')
        })
      })
    })

    describe('#given createPlanModeExtension factory', () => {
      it('#then returns a function', () => {
        const factory = createPlanModeExtension({
          createPlan: async () => ({ success: true }),
          startWork: async () => ({ success: true }),
          listPlans: async () => [],
        })
        expect(typeof factory).toBe('function')
      })
    })
  })

  // 5.2.3: skill-loader 从 SKILL.md 加载并注入上下文
  describe('skill-loader', () => {
    describe('#given skill-loader Extension loaded', () => {
      describe('#when session starts with discoverable skills', () => {
        it('#then discovers, injects context, and starts MCPs (5.2.3)', async () => {
          const injectedSkills: { name: string }[] = []
          let mcpStarted = false

          const runner = createExtensionRunner()
          const callbacks = {
            discoverSkills: async () => [
              {
                name: 'my-skill',
                description: '测试 Skill',
                content: '# My Skill\nDo things.',
                mcpServers: ['server-a'],
                parameters: { key: 'value' },
              },
            ],
            injectContext: (skills: { name: string }[]) => {
              injectedSkills.push(...skills)
            },
            startSkillMcps: async () => {
              mcpStarted = true
            },
          }

          const descriptor = createSkillLoaderDescriptor(callbacks)
          await runner.loadAll([descriptor])

          // 触发 session.start 事件
          const eventBus = runner.getEventBus()
          await eventBus.emit('session.start', { sessionId: 'test' })

          expect(injectedSkills).toHaveLength(1)
          expect(injectedSkills[0]?.name).toBe('my-skill')
          expect(mcpStarted).toBe(true)
        })
      })

      describe('#when no skills found', () => {
        it('#then does not inject or start MCPs', async () => {
          let injectCalled = false
          let mcpCalled = false

          const runner = createExtensionRunner()
          const callbacks = {
            discoverSkills: async () => [],
            injectContext: () => { injectCalled = true },
            startSkillMcps: async () => { mcpCalled = true },
          }

          await runner.loadAll([createSkillLoaderDescriptor(callbacks)])
          const eventBus = runner.getEventBus()
          await eventBus.emit('session.start', { sessionId: 'test' })

          expect(injectCalled).toBe(false)
          expect(mcpCalled).toBe(false)
        })
      })

      describe('#when resources.discover event fires', () => {
        it('#then skill resources are added to list', async () => {
          const runner = createExtensionRunner()
          const callbacks = {
            discoverSkills: async () => [
              { name: 'skill-a', description: 'A', content: 'content-a' },
            ],
            injectContext: () => {},
            startSkillMcps: async () => {},
          }

          await runner.loadAll([createSkillLoaderDescriptor(callbacks)])

          // 先触发 session.start 加载 skill
          const eventBus = runner.getEventBus()
          await eventBus.emit('session.start', { sessionId: 'test' })

          // 然后触发 resources.discover
          const event = { resources: [] as string[] }
          await eventBus.emit('resources.discover', event)

          expect(event.resources).toContain('skill:skill-a')
        })
      })
    })

    describe('#given createSkillLoaderExtension factory', () => {
      it('#then returns a function', () => {
        const factory = createSkillLoaderExtension({
          discoverSkills: async () => [],
          injectContext: () => {},
          startSkillMcps: async () => {},
        })
        expect(typeof factory).toBe('function')
      })
    })
  })

  // 5.2.4: git-master 可执行 commit/push/branch 操作
  describe('git-master', () => {
    describe('#given git-master Extension loaded', () => {
      describe('#when loaded into runner', () => {
        it('#then registers 4 git tools (5.2.4)', async () => {
          const runner = createExtensionRunner()
          const callbacks = {
            execGit: async () => ({ success: true, output: 'ok' }),
          }

          const descriptor = createGitMasterDescriptor(callbacks)
          const results = await runner.loadAll([descriptor])

          expect(results[0]?.loaded).toBe(true)

          const registry = runner.getRegistry()
          expect(registry.tools.has('git-commit')).toBe(true)
          expect(registry.tools.has('git-push')).toBe(true)
          expect(registry.tools.has('git-branch')).toBe(true)
          expect(registry.tools.has('git-status')).toBe(true)
        })
      })

      describe('#when git-commit is executed', () => {
        it('#then calls execGit with add and commit args', async () => {
          const calls: string[][] = []
          const runner = createExtensionRunner()
          const callbacks = {
            execGit: async (args: string[]) => {
              calls.push(args)
              return { success: true, output: 'committed' }
            },
          }

          await runner.loadAll([createGitMasterDescriptor(callbacks)])
          const tool = runner.getRegistry().tools.get('git-commit')
          const result = await tool?.execute(
            'gc1',
            { message: 'test commit', addAll: true },
            new AbortController().signal,
          )

          // 应该先 add -A 然后 commit
          expect(calls.length).toBeGreaterThanOrEqual(2)
          expect(calls[0]).toEqual(['add', '-A'])
          expect(calls[1]).toContain('commit')
          expect(calls[1]).toContain('test commit')
          expect(result?.isError).toBeFalsy()
        })
      })

      describe('#when git-branch list is executed', () => {
        it('#then calls execGit with branch -a', async () => {
          let calledArgs: string[] = []
          const runner = createExtensionRunner()
          const callbacks = {
            execGit: async (args: string[]) => {
              calledArgs = args
              return { success: true, output: '* main\n  feature' }
            },
          }

          await runner.loadAll([createGitMasterDescriptor(callbacks)])
          const tool = runner.getRegistry().tools.get('git-branch')
          const result = await tool?.execute(
            'gb1',
            { action: 'list' },
            new AbortController().signal,
          )

          expect(calledArgs).toEqual(['branch', '-a'])
          expect(result?.isError).toBeFalsy()
          const text = result?.content[0]?.type === 'text' ? result.content[0].text : ''
          expect(text).toContain('main')
        })
      })

      describe('#when git-status is executed', () => {
        it('#then calls execGit with status', async () => {
          let calledArgs: string[] = []
          const runner = createExtensionRunner()
          const callbacks = {
            execGit: async (args: string[]) => {
              calledArgs = args
              return { success: true, output: 'On branch main' }
            },
          }

          await runner.loadAll([createGitMasterDescriptor(callbacks)])
          const tool = runner.getRegistry().tools.get('git-status')
          await tool?.execute('gs1', {}, new AbortController().signal)

          expect(calledArgs).toEqual(['status'])
        })
      })
    })

    describe('#given createGitMasterExtension factory', () => {
      it('#then returns a function', () => {
        const factory = createGitMasterExtension({
          execGit: async () => ({ success: true }),
        })
        expect(typeof factory).toBe('function')
      })
    })
  })

  // 5.2.5: tmux-manager 创建/管理 tmux session
  describe('tmux-manager', () => {
    describe('#given tmux-manager Extension loaded', () => {
      describe('#when tmux is available', () => {
        it('#then registers 5 tmux tools (5.2.5)', async () => {
          const runner = createExtensionRunner()
          const callbacks = {
            execTmux: async () => ({ success: true, output: 'ok' }),
            isTmuxAvailable: async () => true,
          }

          const descriptor = createTmuxManagerDescriptor(callbacks)
          const results = await runner.loadAll([descriptor])

          expect(results[0]?.loaded).toBe(true)

          const registry = runner.getRegistry()
          expect(registry.tools.has('tmux-create')).toBe(true)
          expect(registry.tools.has('tmux-list')).toBe(true)
          expect(registry.tools.has('tmux-kill')).toBe(true)
          expect(registry.tools.has('tmux-send')).toBe(true)
          expect(registry.tools.has('tmux-capture')).toBe(true)
        })
      })

      describe('#when tmux-create is executed', () => {
        it('#then calls execTmux with new-session args', async () => {
          let calledArgs: string[] = []
          const runner = createExtensionRunner()
          const callbacks = {
            execTmux: async (args: string[]) => {
              calledArgs = args
              return { success: true }
            },
            isTmuxAvailable: async () => true,
          }

          await runner.loadAll([createTmuxManagerDescriptor(callbacks)])
          const tool = runner.getRegistry().tools.get('tmux-create')
          const result = await tool?.execute(
            'tc1',
            { name: 'my-session' },
            new AbortController().signal,
          )

          expect(calledArgs).toEqual(['new-session', '-d', '-s', 'my-session'])
          expect(result?.isError).toBeFalsy()
        })
      })

      describe('#when tmux is not available', () => {
        it('#then tools return unavailable error', async () => {
          const runner = createExtensionRunner()
          const callbacks = {
            execTmux: async () => ({ success: true }),
            isTmuxAvailable: async () => false,
          }

          await runner.loadAll([createTmuxManagerDescriptor(callbacks)])
          const tool = runner.getRegistry().tools.get('tmux-create')
          const result = await tool?.execute(
            'tc2',
            { name: 'test' },
            new AbortController().signal,
          )

          expect(result?.isError).toBe(true)
          const text = result?.content[0]?.type === 'text' ? result.content[0].text : ''
          expect(text).toContain('不可用')
        })
      })

      describe('#when tmux-kill with all flag', () => {
        it('#then calls kill-server', async () => {
          let calledArgs: string[] = []
          const runner = createExtensionRunner()
          const callbacks = {
            execTmux: async (args: string[]) => {
              calledArgs = args
              return { success: true }
            },
            isTmuxAvailable: async () => true,
          }

          await runner.loadAll([createTmuxManagerDescriptor(callbacks)])
          const tool = runner.getRegistry().tools.get('tmux-kill')
          await tool?.execute('tk1', { all: true }, new AbortController().signal)

          expect(calledArgs).toEqual(['kill-server'])
        })
      })
    })

    // parseTmuxSessions
    describe('#given parseTmuxSessions', () => {
      it('#then parses standard tmux output', () => {
        const output = 'dev: 3 windows (created Mon Jan 1 10:00:00 2025) (attached)\ntest: 1 window (created Mon Jan 1 11:00:00 2025)'
        const sessions = parseTmuxSessions(output)

        expect(sessions).toHaveLength(2)
        expect(sessions[0]?.name).toBe('dev')
        expect(sessions[0]?.windows).toBe(3)
        expect(sessions[0]?.attached).toBe(true)
        expect(sessions[1]?.name).toBe('test')
        expect(sessions[1]?.windows).toBe(1)
        expect(sessions[1]?.attached).toBe(false)
      })

      it('#then returns empty array for empty output', () => {
        expect(parseTmuxSessions('')).toEqual([])
      })

      it('#then handles single window correctly', () => {
        const output = 'session: 1 window (created Tue Jan 1 00:00:00 2025)'
        const sessions = parseTmuxSessions(output)
        expect(sessions).toHaveLength(1)
        expect(sessions[0]?.windows).toBe(1)
      })
    })
  })

  // 多个 Extension 同时加载
  describe('#given multiple extensions loaded simultaneously', () => {
    it('#then all are available in registry', async () => {
      const runner = createExtensionRunner()

      const gitDesc = createGitMasterDescriptor({
        execGit: async () => ({ success: true }),
      })
      const planDesc = createPlanModeDescriptor({
        createPlan: async () => ({ success: true }),
        startWork: async () => ({ success: true }),
        listPlans: async () => [],
      })

      const results = await runner.loadAll([gitDesc, planDesc])

      expect(results.filter((r) => r.loaded)).toHaveLength(2)
      expect(runner.getLoadedExtensionNames()).toContain('git-master')
      expect(runner.getLoadedExtensionNames()).toContain('plan-mode')

      const reg = runner.getRegistry()
      expect(reg.tools.has('git-commit')).toBe(true)
      expect(reg.commands.has('plan')).toBe(true)
    })
  })

  // 卸载
  describe('#given extension is loaded then unloaded', () => {
    it('#then tools and commands are cleaned up', async () => {
      const runner = createExtensionRunner()
      const descriptor = createPlanModeDescriptor({
        createPlan: async () => ({ success: true }),
        startWork: async () => ({ success: true }),
        listPlans: async () => [],
      })

      await runner.loadAll([descriptor])
      expect(runner.getRegistry().commands.has('plan')).toBe(true)

      runner.unload('plan-mode')
      expect(runner.getRegistry().commands.has('plan')).toBe(false)
    })
  })
})
