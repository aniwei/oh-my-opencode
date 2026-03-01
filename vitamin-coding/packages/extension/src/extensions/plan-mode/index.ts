// plan-mode Extension — Plan/Build 模式（§S9, 5.2.2）
// 注册 /plan 和 /start-work 斜杠命令

import type { ExtensionFactory } from '../../types'

// plan-mode 外部依赖回调接口
export interface PlanModeCallbacks {
  // 生成计划: 用户描述 → 调用 Metis→Prometheus→Momus 管线
  createPlan: (description: string) => Promise<{ success: boolean; planName?: string; error?: string }>
  // 执行计划: 计划名称 → 调用 Atlas 执行
  startWork: (planName: string) => Promise<{ success: boolean; error?: string }>
  // 列出已有计划
  listPlans: () => Promise<string[]>
}

// 创建 plan-mode Extension 工厂
export function createPlanModeExtension(callbacks: PlanModeCallbacks): ExtensionFactory {
  return (api) => {
    api.log.info('plan-mode Extension 初始化')

    // /plan 命令 — 创建或列出计划
    api.registerCommand({
      name: 'plan',
      description: '创建执行计划。用法: /plan <描述> 或 /plan list',
      async execute(args: string) {
        const trimmed = args.trim()

        if (!trimmed || trimmed === 'list') {
          // 列出已有计划
          const plans = await callbacks.listPlans()
          if (plans.length === 0) {
            api.log.info('当前没有已保存的计划')
            return
          }
          api.log.info(`已有计划:\n${plans.map((p) => `  - ${p}`).join('\n')}`)
          return
        }

        // 创建新计划
        api.log.info(`正在创建计划: ${trimmed}`)
        const result = await callbacks.createPlan(trimmed)
        if (result.success) {
          api.log.info(`计划已创建: ${result.planName ?? '(unnamed)'}`)
        } else {
          api.log.error(`计划创建失败: ${result.error ?? 'unknown error'}`)
        }
      },
    })

    // /start-work 命令 — 执行已有计划
    api.registerCommand({
      name: 'start-work',
      description: '执行已有的计划。用法: /start-work <计划名称>',
      async execute(args: string) {
        const planName = args.trim()
        if (!planName) {
          api.log.error('请提供计划名称。用法: /start-work <计划名称>')
          return
        }

        api.log.info(`正在启动计划: ${planName}`)
        const result = await callbacks.startWork(planName)
        if (result.success) {
          api.log.info(`计划 ${planName} 执行完成`)
        } else {
          api.log.error(`计划执行失败: ${result.error ?? 'unknown error'}`)
        }
      },
    })

    api.log.info('plan-mode Extension 已注册 /plan 和 /start-work 命令')
  }
}

// 创建 plan-mode Extension 描述符
export function createPlanModeDescriptor(
  callbacks: PlanModeCallbacks,
): { name: string; source: 'builtin'; entryPoint: string; factory: ExtensionFactory } {
  return {
    name: 'plan-mode',
    source: 'builtin',
    entryPoint: __filename,
    factory: createPlanModeExtension(callbacks),
  }
}
