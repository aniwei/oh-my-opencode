// git-master Extension — Git 高级操作（§S9, 5.2.4）
// 提供 commit/push/branch/status 等 git 操作工具

import { z } from 'zod'

import type { AgentTool, ToolResult } from '@vitamin/agent'

import type { ExtensionFactory } from '../../types'

// Git 操作结果
export interface GitOperationResult {
  success: boolean
  output?: string
  error?: string
}

// git-master 外部依赖回调接口
export interface GitMasterCallbacks {
  execGit: (args: string[], cwd?: string) => Promise<GitOperationResult>
}

// Zod schemas
const GitCommitSchema = z.object({
  message: z.string().describe('提交消息'),
  amend: z.boolean().optional().describe('修改上一次提交'),
  addAll: z.boolean().optional().describe('提交前 git add -A（默认 true）'),
})

const GitPushSchema = z.object({
  remote: z.string().optional().describe('远程名称（默认 origin）'),
  force: z.boolean().optional().describe('是否强制推送'),
  setUpstream: z.boolean().optional().describe('是否设置上游跟踪'),
})

const GitBranchSchema = z.object({
  action: z.enum(['create', 'switch', 'list', 'delete']).describe('操作类型'),
  name: z.string().optional().describe('分支名称（create/switch/delete 时必填）'),
  from: z.string().optional().describe('从哪个分支创建（create 时可选）'),
})

const GitStatusSchema = z.object({
  short: z.boolean().optional().describe('使用简短格式'),
})

// 创建 git-master Extension 工厂
export function createGitMasterExtension(callbacks: GitMasterCallbacks): ExtensionFactory {
  return (api) => {
    api.log.info('git-master Extension 初始化')

    // git-commit 工具
    api.registerTool({
      name: 'git-commit',
      description: '创建 Git 提交。自动 stage 所有修改然后提交。',
      parameters: GitCommitSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        const args = GitCommitSchema.parse(rawArgs)
        const addAll = args.addAll !== false
        if (addAll) {
          const addResult = await callbacks.execGit(['add', '-A'])
          if (!addResult.success) {
            return { content: [{ type: 'text', text: `git add 失败: ${addResult.error ?? 'unknown'}` }], isError: true }
          }
        }
        const commitArgs = args.amend ? ['commit', '--amend', '-m', args.message] : ['commit', '-m', args.message]
        const result = await callbacks.execGit(commitArgs)
        return {
          content: [{ type: 'text', text: result.success ? (result.output ?? 'committed') : `commit 失败: ${result.error ?? 'unknown'}` }],
          isError: !result.success,
        }
      },
    } as AgentTool)

    // git-push 工具
    api.registerTool({
      name: 'git-push',
      description: '推送当前分支到远程仓库。',
      parameters: GitPushSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        const args = GitPushSchema.parse(rawArgs)
        const remote = args.remote ?? 'origin'
        const pushArgs = ['push', remote]
        if (args.force) pushArgs.push('--force')
        if (args.setUpstream) pushArgs.push('--set-upstream')
        const branchResult = await callbacks.execGit(['branch', '--show-current'])
        const branch = branchResult.output?.trim()
        if (branch) pushArgs.push(branch)
        const result = await callbacks.execGit(pushArgs)
        return {
          content: [{ type: 'text', text: result.success ? (result.output ?? 'pushed') : `push 失败: ${result.error ?? 'unknown'}` }],
          isError: !result.success,
        }
      },
    } as AgentTool)

    // git-branch 工具
    api.registerTool({
      name: 'git-branch',
      description: '创建、切换或列出 Git 分支。',
      parameters: GitBranchSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        const args = GitBranchSchema.parse(rawArgs)
        switch (args.action) {
          case 'list': {
            const result = await callbacks.execGit(['branch', '-a'])
            return { content: [{ type: 'text', text: result.output ?? '(no branches)' }], isError: !result.success }
          }
          case 'create': {
            if (!args.name) return { content: [{ type: 'text', text: '创建分支需要提供名称' }], isError: true }
            const createArgs = ['checkout', '-b', args.name]
            if (args.from) createArgs.push(args.from)
            const result = await callbacks.execGit(createArgs)
            return { content: [{ type: 'text', text: result.success ? `已创建并切换到分支 ${args.name}` : `创建分支失败: ${result.error ?? 'unknown'}` }], isError: !result.success }
          }
          case 'switch': {
            if (!args.name) return { content: [{ type: 'text', text: '切换分支需要提供名称' }], isError: true }
            const result = await callbacks.execGit(['checkout', args.name])
            return { content: [{ type: 'text', text: result.success ? `已切换到分支 ${args.name}` : `切换分支失败: ${result.error ?? 'unknown'}` }], isError: !result.success }
          }
          case 'delete': {
            if (!args.name) return { content: [{ type: 'text', text: '删除分支需要提供名称' }], isError: true }
            const result = await callbacks.execGit(['branch', '-d', args.name])
            return { content: [{ type: 'text', text: result.success ? `已删除分支 ${args.name}` : `删除分支失败: ${result.error ?? 'unknown'}` }], isError: !result.success }
          }
        }
      },
    } as AgentTool)

    // git-status 工具
    api.registerTool({
      name: 'git-status',
      description: '显示 Git 仓库状态（修改、暂存、未跟踪文件）。',
      parameters: GitStatusSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        const args = GitStatusSchema.parse(rawArgs)
        const statusArgs = args.short ? ['status', '--short'] : ['status']
        const result = await callbacks.execGit(statusArgs)
        return { content: [{ type: 'text', text: result.output ?? '(no output)' }], isError: !result.success }
      },
    } as AgentTool)

    api.log.info('git-master Extension 已注册 4 个 git 工具')
  }
}

// 创建 git-master Extension 描述符
export function createGitMasterDescriptor(
  callbacks: GitMasterCallbacks,
): { name: string; source: 'builtin'; entryPoint: string; factory: ExtensionFactory } {
  return {
    name: 'git-master',
    source: 'builtin',
    entryPoint: __filename,
    factory: createGitMasterExtension(callbacks),
  }
}
