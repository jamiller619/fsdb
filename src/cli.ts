#!/usr/bin/env node
import { type ParseArgsOptionsConfig, parseArgs } from 'node:util'
import main from './main.ts'

const options: ParseArgsOptionsConfig = {
  dir: { type: 'string' },
  db: { type: 'string' },
}

const { values } = parseArgs({ options })

await main(values.db as string, values.dir as string)
