import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import path from 'node:path'
import { type ChokidarOptions, type FSWatcher, watch } from 'chokidar'
import { type Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'

export type FileRecord = {
  id?: number
  file_path: string
  size: number
  modified_time: number
  checksum: string
  created_at: string
  updated_at: string
}

export default class FileSyncManager extends EventEmitter {
  #db: Database | null = null
  #watcher: FSWatcher | null = null
  #watchFolder: string
  #watchOptions: ChokidarOptions
  #dbPath: string

  constructor(
    dbPath: string,
    watchFolder: string,
    watchOptions: ChokidarOptions = {},
  ) {
    super()

    this.#watchFolder = path.resolve(watchFolder)
    this.#dbPath = path.resolve(dbPath)
    this.#watchOptions = watchOptions
  }

  /**
   * Initialize the database and create the files table if it doesn't exist
   */
  async #initializeDatabase(): Promise<void> {
    try {
      this.#db = await open({
        filename: this.#dbPath,
        driver: sqlite3.Database,
      })

      await this.#db.exec(/* sql */ `
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT UNIQUE NOT NULL,
          size INTEGER NOT NULL,
          modified_time INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_file_path ON files(file_path);
        CREATE INDEX IF NOT EXISTS idx_modified_time ON files(modified_time);
      `)

      console.log('✅ Database initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Calculate SHA-256 checksum for a file
   */
  async #calculateChecksum(filePath: string): Promise<string> {
    try {
      const data = await fs.readFile(filePath)
      return createHash('sha256').update(data).digest('hex')
    } catch (error) {
      console.error(`❌ Failed to calculate checksum for ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Get file stats and create a FileRecord
   */
  async #createFileRecord(filePath: string): Promise<FileRecord> {
    try {
      const stats = await fs.stat(filePath)
      const checksum = await this.#calculateChecksum(filePath)
      const now = new Date().toISOString()

      return {
        file_path: filePath,
        size: stats.size,
        modified_time: Math.floor(stats.mtime.getTime() / 1000),
        checksum,
        created_at: now,
        updated_at: now,
      }
    } catch (error) {
      console.error(`❌ Failed to create file record for ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Recursively scan a directory and return all file paths
   */
  async #scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.#scanDirectory(fullPath)

          files.push(...subFiles)
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`❌ Failed to scan directory ${dirPath}:`, error)

      throw error
    }

    return files
  }

  /**
   * Insert a new file record into the database
   */
  async #insertFileRecord(record: FileRecord): Promise<void> {
    if (!this.#db) throw new Error('Database not initialized')

    try {
      const result = await this.#db.run(
        /* sql */ `
        INSERT INTO files (file_path, size, modified_time, checksum, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          record.file_path,
          record.size,
          record.modified_time,
          record.checksum,
          record.created_at,
          record.updated_at,
        ],
      )

      this.emit('file.added', {
        ...record,
        id: result.lastID,
      })

      console.log(`➕ Added: ${record.file_path}`)
    } catch (error) {
      console.error(
        `❌ Failed to insert file record for ${record.file_path}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Update an existing file record in the database
   */
  async #updateFileRecord(record: FileRecord): Promise<FileRecord> {
    if (!this.#db) throw new Error('Database not initialized')

    try {
      await this.#db.run(
        /* sql */ `
        UPDATE files
        SET size = ?, modified_time = ?, checksum = ?, updated_at = ?
        WHERE file_path = ?`,
        [
          record.size,
          record.modified_time,
          record.checksum,
          record.updated_at,
          record.file_path,
        ],
      )

      this.emit('file.updated', record)

      console.log(`🔄 Updated: ${record.file_path}`)

      return record
    } catch (error) {
      console.error(
        `❌ Failed to update file record for ${record.file_path}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Remove a file record from the database
   */
  async #removeFileRecord(filePath: string): Promise<void> {
    if (!this.#db) throw new Error('Database not initialized')

    try {
      await this.#db.run(
        /* sql */ `
        DELETE FROM files WHERE file_path = ?`,
        [filePath],
      )

      this.emit('file.removed', filePath)

      console.log(`➖ Removed: ${filePath}`)
    } catch (error) {
      console.error(`❌ Failed to remove file record for ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Get all file records from the database
   */
  async #getAllFileRecords(): Promise<Map<string, FileRecord>> {
    if (!this.#db) throw new Error('Database not initialized')

    try {
      const rows = await this.#db.all<FileRecord[]>(
        /* sql */ `SELECT * FROM files`,
      )
      const recordMap = new Map<string, FileRecord>()

      rows.forEach((row: any) => {
        recordMap.set(row.file_path, row)
      })

      return recordMap
    } catch (error) {
      console.error('❌ Failed to fetch file records from database:', error)
      throw error
    }
  }

  /**
   * Check if a file has changed compared to its database record
   */
  async #hasFileChanged(
    filePath: string,
    dbRecord: FileRecord,
  ): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      const modifiedTime = Math.floor(stats.mtime.getTime() / 1000)

      // Quick check: if size or modified time is different, file has changed
      if (
        stats.size !== dbRecord.size ||
        modifiedTime !== dbRecord.modified_time
      ) {
        return true
      }

      // If size and modified time are the same, check checksum to be sure
      const currentChecksum = await this.#calculateChecksum(filePath)

      return currentChecksum !== dbRecord.checksum
    } catch (error) {
      console.error(
        `❌ Failed to check if file changed for ${filePath}:`,
        error,
      )
      return true // Assume changed if we can't check
    }
  }

  /**
   * Perform initial synchronization of the database with the filesystem
   */
  async performInitialSync(): Promise<void> {
    console.log(`🔄 Starting initial sync for: ${this.#watchFolder}`)

    try {
      // Get current filesystem state
      const currentFiles = await this.#scanDirectory(this.#watchFolder)
      console.log(`📁 Found ${currentFiles.length} files in filesystem`)

      // Get current database state
      const dbRecords = await this.#getAllFileRecords()
      console.log(`💾 Found ${dbRecords.size} records in database`)

      const processedFiles = new Set<string>()

      // Process each file in the filesystem
      for (const filePath of currentFiles) {
        processedFiles.add(filePath)
        const dbRecord = dbRecords.get(filePath)

        if (!dbRecord) {
          // New file - insert into database
          const fileRecord = await this.#createFileRecord(filePath)

          await this.#insertFileRecord(fileRecord)
        } else {
          // Existing file - check if changed
          const hasChanged = await this.#hasFileChanged(filePath, dbRecord)
          if (hasChanged) {
            const updatedRecord = await this.#createFileRecord(filePath)

            await this.#updateFileRecord({
              ...updatedRecord,
              id: dbRecord.id,
            })
          }
        }
      }

      // Remove database records for files that no longer exist
      for (const [filePath] of dbRecords) {
        if (!processedFiles.has(filePath)) {
          await this.#removeFileRecord(filePath)
        }
      }

      console.log('✅ Initial sync completed successfully')
    } catch (error) {
      console.error('❌ Initial sync failed:', error)
      throw error
    }
  }

  /**
   * Handle file addition or change events
   */
  async #handleFileAddOrChange(filePath: string): Promise<void> {
    try {
      // Small delay to ensure file operations are complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      const fileRecord = await this.#createFileRecord(filePath)

      if (!this.#db) throw new Error('Database not initialized')

      try {
        await this.#updateFileRecord(fileRecord)
      } catch {
        // No existing record, insert new one
        await this.#insertFileRecord(fileRecord)
      }
    } catch (error) {
      console.error(
        `❌ Failed to handle file add/change for ${filePath}:`,
        error,
      )
    }
  }

  /**
   * Start file watching
   */
  async startWatching(): Promise<void> {
    console.log(`👁️  Starting file watcher for: ${this.#watchFolder}`)

    const defaultOptions: ChokidarOptions = {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
    }

    this.#watcher = watch(this.#watchFolder, {
      ...defaultOptions,
      ...this.#watchOptions, // Allow overriding with custom options
      ignoreInitial: true, // Don't trigger events for existing files on startup
      persistent: true, // Keep watching for changes
    })

    this.#watcher
      .on('add', (filePath: string) => {
        console.log(`📄 File added: ${filePath}`)
        this.#handleFileAddOrChange(filePath)
      })
      .on('change', (filePath: string) => {
        console.log(`📝 File changed: ${filePath}`)
        this.#handleFileAddOrChange(filePath)
      })
      .on('unlink', (filePath: string) => {
        console.log(`🗑️  File deleted: ${filePath}`)
        this.#removeFileRecord(filePath)
      })
      .on('error', (error) => {
        console.error('❌ Watcher error:', error)
      })

    console.log('✅ File watcher started successfully')
  }

  /**
   * Stop file watching
   */
  async stopWatching(): Promise<void> {
    if (this.#watcher) {
      await this.#watcher.close()

      this.#watcher = null

      console.log('⏹️  File watcher stopped')
    }
  }

  /**
   * Close database connection
   */
  async closeDatabase(): Promise<void> {
    if (this.#db) {
      await this.#db.close()

      this.#db = null

      console.log('🔒 Database connection closed')
    }
  }

  /**
   * Initialize and start the file sync manager
   */
  async start(): Promise<void> {
    try {
      await this.#initializeDatabase()
      await this.performInitialSync()
      await this.startWatching()

      console.log('🚀 File sync manager started successfully')
      console.log('Press Ctrl+C to stop...')
    } catch (error) {
      console.error('❌ Failed to start file sync manager:', error)
      throw error
    }
  }

  /**
   * Gracefully shutdown the file sync manager
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down file sync manager...')

    await this.stopWatching()
    await this.closeDatabase()

    console.log('✅ File sync manager shut down successfully')
  }
}
