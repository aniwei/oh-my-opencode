#!/usr/bin/env node
import {
  parseCLIFull,
  main,
  executeDoctorCommand,
  executeAuthCommand,
  executeInstallCommand,
  executeConfigCommand,
} from '../src/index'

async function runCli(argv = process.argv) {
  const parsed = parseCLIFull(argv)

  switch (parsed.subCommand) {
    case 'doctor':
      await executeDoctorCommand(parsed.options.projectDir)
      return
    case 'auth':
      await executeAuthCommand(parsed.options.projectDir, parsed.subCommandArgs)
      return
    case 'install':
      await executeInstallCommand(parsed.options.projectDir)
      return
    case 'config':
      await executeConfigCommand(parsed.options.projectDir, parsed.subCommandArgs)
      return
    default:
      await main(parsed.options)
  }
}

runCli().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`致命错误：${message}\n`)
  process.exitCode = 1
})
