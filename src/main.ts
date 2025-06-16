import path from 'node:path'
import process from 'node:process'
import FileSyncManager, {
  type FileSyncManagerOptions,
} from './FileSyncManager.ts'

export default async function main(
  options: FileSyncManagerOptions,
): Promise<void> {
  console.log('🎯 File Sync Manager Starting...')
  console.log(`📁 Watch Folder: ${path.resolve(options['watch.folder'])}`)
  console.log(`💾 Database Path: ${path.resolve(options['db.path'])}`)

  const syncManager = new FileSyncManager(options)

  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error)
    gracefulShutdown('uncaughtException')
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
    gracefulShutdown('unhandledRejection')
  })

  try {
    await syncManager.start()

    process.stdin.resume()
  } catch (error) {
    console.error('❌ Failed to start application:', error)
    process.exit(1)
  }

  async function gracefulShutdown(signal: string) {
    console.log(`\n📡 Received ${signal}, initiating graceful shutdown...`)
    try {
      await syncManager.shutdown()
      process.exit(0)
    } catch (error) {
      console.error('❌ Error during shutdown:', error)
      process.exit(1)
    }
  }
}
