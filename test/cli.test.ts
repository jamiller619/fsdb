import assert from 'node:assert'
import { fork } from 'node:child_process'
import fs from 'node:fs/promises'
import { after, before, describe, test } from 'node:test'
import { createTestDir, getTestFilePaths } from './utils.ts'

describe('CLI', async () => {
  const { tmpDir, cliPath, testDir, testDb } = getTestFilePaths()

  before(async () => {
    await createTestDir(testDir)
  })

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('should parse --dir and --db arguments and call main', async () => {
    const args = ['--dir', testDir, '--db', testDb]
    const child = createChildProcess(cliPath, args)

    let stdout = ''
    let stderr = ''

    await new Promise((resolve, reject) => {
      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('error', reject)

      child.on('close', (code) => {
        assert.ok(
          stdout.includes('File Sync Manager Starting'),
          'Should log starting message',
        )
        assert.ok(stdout.includes('Watch Folder:'), 'Should log watch folder')
        assert.ok(stdout.includes('Database Path:'), 'Should log database path')

        assert.equal(code, 0, 'Should exit with code 0')

        resolve(void 0)
      })
    }).catch((error) => {
      console.error('Error in CLI test:', error)

      throw error
    })
  })

  test('should exit with code 1 if main throws', async () => {
    // Pass an invalid argument to cause main to fail
    const args = ['--dir', '', '--db', '']
    const child = createChildProcess(cliPath, args)

    let stderr = ''

    await new Promise((resolve, reject) => {
      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('error', reject)

      child.on('close', (code) => {
        assert.equal(code, 1, 'Should exit with code 1')
        assert(
          stderr.includes('Failed to start application'),
          'Should log failure message',
        )

        resolve(void 0)
      })
    }).catch((error) => {
      console.error('Error in CLI test:', error)

      throw error
    })
  })
})

function createChildProcess(cliPath: string, args: string[]) {
  const child = fork(cliPath, [...args], {
    stdio: ['ipc'],
  })

  return child
}
