// 注册所有内置工具到 ToolRegistry
import { createAstGrepTool } from './builtin/ast-grep'
import { createBashTool } from './builtin/bash'
import { createEditTool } from './builtin/edit'
import { createEditDiffTool } from './builtin/edit-diff'
import { createFindTool } from './builtin/find'
import { createGlobTool } from './builtin/glob'
import { createGrepTool } from './builtin/grep'
import { createHashlineEditTool } from './builtin/hashline-edit'
import { createInteractiveBashTool } from './builtin/interactive-bash'
import { createLookAtTool } from './builtin/look-at'
import { createLsTool } from './builtin/ls'
import { createReadTool } from './builtin/read'
import { createWriteTool } from './builtin/write'
import { createDelegateTaskTool } from './orchestration/delegate-task'
import { createStartWorkTool } from './orchestration/start-work'
import { createBackgroundOutputTool } from './orchestration/background-output'
import { createBackgroundCancelTool } from './orchestration/background-cancel'
import { createCallAgentTool } from './orchestration/call-agent'
import { createSkillExecutorTool } from './skill/skill-executor'
import { createSkillMcpTool } from './skill/skill-mcp'
import { createSkillLoaderTool } from './skill/skill-loader'
import { createSessionManagerTool } from './session/session-manager'
import { createTaskCreateTool } from './task/task-create'
import { createTaskGetTool } from './task/task-get'
import { createTaskListTool } from './task/task-list'
import { createTaskUpdateTool } from './task/task-update'

import type { ToolRegistry } from './tool-registry'
import type { TaskDispatchFn } from './orchestration/delegate-task'
import type { StartWorkFn } from './orchestration/start-work'
import type { GetBackgroundOutputFn } from './orchestration/background-output'
import type { CancelBackgroundFn } from './orchestration/background-cancel'
import type { CallAgentFn } from './orchestration/call-agent'
import type { ExecuteSkillFn } from './skill/skill-executor'
import type { CallSkillMcpFn } from './skill/skill-mcp'
import type { LoadSkillFn } from './skill/skill-loader'
import type { SessionManagerFns } from './session/session-manager'
import type { CreateTaskFn } from './task/task-create'
import type { GetTaskFn } from './task/task-get'
import type { ListTasksFn } from './task/task-list'
import type { UpdateTaskFn } from './task/task-update'

export interface RegisterBuiltinOptions {
  projectRoot: string
  taskDispatchFn?: TaskDispatchFn
  startWorkFn?: StartWorkFn
  getBackgroundOutputFn?: GetBackgroundOutputFn
  cancelBackgroundFn?: CancelBackgroundFn
  callAgentFn?: CallAgentFn
  executeSkillFn?: ExecuteSkillFn
  callSkillMcpFn?: CallSkillMcpFn
  loadSkillFn?: LoadSkillFn
  sessionManagerFns?: SessionManagerFns
  createTaskFn?: CreateTaskFn
  getTaskFn?: GetTaskFn
  listTasksFn?: ListTasksFn
  updateTaskFn?: UpdateTaskFn
}

// 注册所有内置工具 (minimal + standard + full 预设)
export function registerBuiltinTools(
  registry: ToolRegistry,
  projectRoot: string,
  options?: Omit<RegisterBuiltinOptions, 'projectRoot'>,
): void {
  // minimal 预设 (4 个基础工具)
  registry.register(createReadTool(projectRoot), {
    preset: 'minimal',
    category: 'filesystem',
    builtin: true,
  })

  registry.register(createWriteTool(projectRoot), {
    preset: 'minimal',
    category: 'filesystem',
    builtin: true,
  })

  registry.register(createEditTool(projectRoot), {
    preset: 'minimal',
    category: 'filesystem',
    builtin: true,
  })

  registry.register(createBashTool(projectRoot), {
    preset: 'minimal',
    category: 'shell',
    builtin: true,
  })

  // standard 预设 (6 个搜索/导航工具)
  registry.register(createGrepTool(projectRoot), {
    preset: 'standard',
    category: 'search',
    builtin: true,
  })

  registry.register(createGlobTool(projectRoot), {
    preset: 'standard',
    category: 'search',
    builtin: true,
  })

  registry.register(createFindTool(projectRoot), {
    preset: 'standard',
    category: 'search',
    builtin: true,
  })

  registry.register(createLsTool(projectRoot), {
    preset: 'standard',
    category: 'search',
    builtin: true,
  })

  registry.register(createAstGrepTool(projectRoot), {
    preset: 'standard',
    category: 'search',
    builtin: true,
  })

  registry.register(createDelegateTaskTool(options?.taskDispatchFn), {
    preset: 'standard',
    category: 'orchestration',
    builtin: true,
  })

  // full 预设 (16 个高级工具)

  // builtin 高级编辑/查看
  registry.register(createEditDiffTool(projectRoot), {
    preset: 'full',
    category: 'filesystem',
    builtin: true,
  })

  registry.register(createLookAtTool(projectRoot), {
    preset: 'full',
    category: 'multimodal',
    builtin: true,
  })

  registry.register(createInteractiveBashTool(projectRoot), {
    preset: 'full',
    category: 'shell',
    builtin: true,
  })

  registry.register(createHashlineEditTool(projectRoot), {
    preset: 'full',
    category: 'filesystem',
    builtin: true,
  })

  // 编排工具
  registry.register(createStartWorkTool(options?.startWorkFn), {
    preset: 'full',
    category: 'orchestration',
    builtin: true,
  })

  registry.register(createBackgroundOutputTool(options?.getBackgroundOutputFn), {
    preset: 'full',
    category: 'orchestration',
    builtin: true,
  })

  registry.register(createBackgroundCancelTool(options?.cancelBackgroundFn), {
    preset: 'full',
    category: 'orchestration',
    builtin: true,
  })

  registry.register(createCallAgentTool(options?.callAgentFn), {
    preset: 'full',
    category: 'orchestration',
    builtin: true,
  })

  // Skill 工具
  registry.register(createSkillExecutorTool(options?.executeSkillFn), {
    preset: 'full',
    category: 'skill',
    builtin: true,
  })

  registry.register(createSkillMcpTool(options?.callSkillMcpFn), {
    preset: 'full',
    category: 'skill',
    builtin: true,
  })

  registry.register(createSkillLoaderTool(options?.loadSkillFn), {
    preset: 'full',
    category: 'skill',
    builtin: true,
  })

  // 会话管理
  registry.register(createSessionManagerTool(options?.sessionManagerFns), {
    preset: 'full',
    category: 'session',
    builtin: true,
  })

  // 任务管理
  registry.register(createTaskCreateTool(options?.createTaskFn), {
    preset: 'full',
    category: 'task',
    builtin: true,
  })

  registry.register(createTaskGetTool(options?.getTaskFn), {
    preset: 'full',
    category: 'task',
    builtin: true,
  })

  registry.register(createTaskListTool(options?.listTasksFn), {
    preset: 'full',
    category: 'task',
    builtin: true,
  })

  registry.register(createTaskUpdateTool(options?.updateTaskFn), {
    preset: 'full',
    category: 'task',
    builtin: true,
  })
}
