import process from 'node:process'
import { type FileRecord } from './FileSyncManager.ts'
import main from './main.ts'

export { type FileRecord }

if (import.meta.url === `file://${process.argv[1]}`) {
  const watchFolder = process.env.WATCH_FOLDER
  const dbPath = process.env.DB_PATH

  if (!watchFolder || !dbPath) {
    throw new Error(`❌ Error: WATCH_FOLDER and DB_PATH are both required!`)
  }

  await main(watchFolder, dbPath)
}
