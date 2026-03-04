import { BashTool } from './BashTool.js'
import { ReadTool } from './ReadTool.js'
import { WriteTool } from './WriteTool.js'
import { EditTool } from './EditTool.js'
import { ApplyPatchTool } from './ApplyPatchTool.js'
import { GrepTool } from './GrepTool.js'
import { GlobTool } from './GlobTool.js'
import { ListTool } from './ListTool.js'
import { TaskTool } from './TaskTool.js'
import { WebFetchTool } from './WebFetchTool.js'
import { TodoWriteTool } from './TodoWriteTool.js'
import { QuestionTool } from './QuestionTool.js'
import { SkillTool } from './SkillTool.js'
import { InlineTool } from './InlineTool.js'
import { BlockTool } from './BlockTool.js'

export type ToolType =
  | 'bash'
  | 'read'
  | 'write'
  | 'edit'
  | 'apply_patch'
  | 'grep'
  | 'glob'
  | 'list'
  | 'task'
  | 'webfetch'
  | 'todo_write'
  | 'question'
  | 'skill'
  | 'inline'
  | 'block'

export interface ToolPartData {
  type: ToolType
  /** Tool-specific args — shape varies by type */
  args: Record<string, unknown>
}

interface ToolPartProps {
  data: ToolPartData
}

/**
 * Routing component — dispatches to the correct tool renderer based on type.
 */
export function ToolPart({ data }: ToolPartProps) {
  const { type, args } = data

  switch (type) {
    case 'bash':
      return (
        <BashTool
          command={(args['command'] as string) ?? ''}
          output={args['output'] as string | undefined}
          exitCode={args['exitCode'] as number | undefined}
          isRunning={args['isRunning'] as boolean | undefined}
        />
      )
    case 'read':
      return (
        <ReadTool
          filePath={(args['filePath'] as string) ?? ''}
          lineCount={args['lineCount'] as number | undefined}
        />
      )
    case 'write':
      return (
        <WriteTool
          filePath={(args['filePath'] as string) ?? ''}
          lineCount={args['lineCount'] as number | undefined}
          isNew={args['isNew'] as boolean | undefined}
        />
      )
    case 'edit':
      return (
        <EditTool
          filePath={(args['filePath'] as string) ?? ''}
          additions={args['additions'] as number | undefined}
          deletions={args['deletions'] as number | undefined}
        />
      )
    case 'apply_patch':
      return (
        <ApplyPatchTool
          filePath={(args['filePath'] as string) ?? ''}
          hunks={args['hunks'] as number | undefined}
        />
      )
    case 'grep':
      return (
        <GrepTool
          pattern={(args['pattern'] as string) ?? ''}
          matchCount={args['matchCount'] as number | undefined}
          fileCount={args['fileCount'] as number | undefined}
        />
      )
    case 'glob':
      return (
        <GlobTool
          pattern={(args['pattern'] as string) ?? ''}
          matchCount={args['matchCount'] as number | undefined}
        />
      )
    case 'list':
      return (
        <ListTool
          directory={(args['directory'] as string) ?? ''}
          fileCount={args['fileCount'] as number | undefined}
        />
      )
    case 'task':
      return (
        <TaskTool
          description={(args['description'] as string) ?? ''}
          status={args['status'] as 'running' | 'completed' | 'failed' | undefined}
        />
      )
    case 'webfetch':
      return (
        <WebFetchTool
          url={(args['url'] as string) ?? ''}
          status={args['status'] as 'fetching' | 'completed' | 'failed' | undefined}
          statusCode={args['statusCode'] as number | undefined}
        />
      )
    case 'todo_write':
      return (
        <TodoWriteTool
          todos={(args['todos'] as Array<{ status: string; content: string }>) ?? []}
        />
      )
    case 'question':
      return (
        <QuestionTool
          question={(args['question'] as string) ?? ''}
          answer={args['answer'] as string | undefined}
        />
      )
    case 'skill':
      return (
        <SkillTool
          skillName={(args['skillName'] as string) ?? ''}
          status={args['status'] as 'running' | 'completed' | 'failed' | undefined}
          output={args['output'] as string | undefined}
        />
      )
    case 'inline':
      return (
        <InlineTool
          name={(args['name'] as string) ?? type}
          input={args['input'] as string | undefined}
          output={args['output'] as string | undefined}
        />
      )
    case 'block':
      return (
        <BlockTool
          name={(args['name'] as string) ?? type}
          content={args['content'] as string | undefined}
        />
      )
    default:
      return (
        <InlineTool
          name={type}
          input={JSON.stringify(args)}
        />
      )
  }
}
