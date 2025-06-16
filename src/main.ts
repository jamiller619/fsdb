import path from 'node:path'
import FileSyncManager from './FileSyncManager.ts'

export default async function main(dbPath: string, watchFolder: string) {
  console.log('🎯 File Sync Manager Starting...')
  console.log(`📁 Watch Folder: ${path.resolve(watchFolder)}`)
  console.log(`💾 Database Path: ${path.resolve(dbPath)}`)

  const syncManager = new FileSyncManager(dbPath, watchFolder)

  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

  // Handle uncaught errors
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

    // Keep the process running
    process.stdin.resume()
  } catch (error) {
    console.error('❌ Failed to start application:', error)
    process.exit(1)
  }

  // Graceful shutdown handling
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
