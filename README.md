# File Sync Manager

A robust Node.js application that keeps a SQLite database table synchronized with the contents of a folder on your computer. It performs initial synchronization on startup and then watches for real-time file changes.

## Features

- **Initial Database Sync**: Scans target folder recursively on startup and synchronizes database with current filesystem state
- **Live File Watching**: Real-time monitoring of file additions, modifications, and deletions using `chokidar`
- **SQLite Storage**: Efficient local database storage with proper indexing
- **File Integrity**: SHA-256 checksums for file integrity validation
- **Error Handling**: Comprehensive error handling and logging
- **Graceful Shutdown**: Proper cleanup on application exit
- **TypeScript**: Full type safety
- **No Build Step**: This project natively runs TypeScript
  via Node.js v22.6.0.

## Database Schema

After running this application, your SQLite database will contain a `files` table with the following structure:

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT UNIQUE NOT NULL,
  size INTEGER NOT NULL,
  modified_time INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Installation

1. Clone or download the project files
2. Install dependencies:

```bash
yarn
```

## Options

An options object should be provided to the application with
the following properties:
```json
{
  "watch.folder": "/path/to/watch",
  "db.path": "/path/to/database.db"
}
```

You can also pass in a "watch.options" property that will be
passed directly to `chokidar.watch`.

## Usage

### Development Mode

Run with hot-reloading during development:

```bash
yarn dev
```

### Production Build

Run the application:

```bash
yarn start
```

## How It Works

### Startup Process

1. **Database Initialization**: Creates a SQLite database and table if they don't exist
2. **Initial Scan**: Recursively scans the target folder
3. **Synchronization**: Compares filesystem state with database records:
   - Inserts new files
   - Updates changed files (based on size, modification time, and checksum)
   - Removes records for deleted files
4. **File Watching**: Starts real-time monitoring using `chokidar`

### Real-time Monitoring

The application watches for:
- **File additions**: New files are added to the database
- **File modifications**: Existing records are updated with new checksums and metadata
- **File deletions**: Corresponding database records are removed

### File Change Detection

Files are considered changed if any of the following differ from the database record:
- File size
- Last modified timestamp
- SHA-256 checksum

## Requirements

- Node.js 23.6.0 or higher

## License

MIT License - Feel free to use and modify as needed.
