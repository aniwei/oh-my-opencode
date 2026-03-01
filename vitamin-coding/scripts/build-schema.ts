import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { VitaminConfigSchema } from '../packages/config/src/schema'

async function main(): Promise<void> {
  const schema = z.toJSONSchema(VitaminConfigSchema)

  const outputPath = resolve(process.cwd(), 'vitamin.schema.json')
  await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf-8')
  console.log(outputPath)
}

void main()
