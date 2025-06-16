import fs from 'node:fs/promises'
import path from 'node:path'

export async function removeTestFiles() {
  const { tmpDir } = getTestFilePaths()

  try {
    await fs.rm(tmpDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

export function getTestFilePaths() {
  const tmpDir = path.join(import.meta.dirname, '../tmp')
  const cliPath = path.join(import.meta.dirname, '../src/cli.ts')
  const testDir = path.join(tmpDir, 'test')
  const testDb = path.join(tmpDir, 'test.db')

  return {
    tmpDir,
    cliPath,
    testDir,
    testDb,
  }
}
