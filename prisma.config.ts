import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

import { databaseBranch, migrationDatabaseUrl } from './src/lib/env'

// Prisma 7 no longer loads .env files by itself, so we do it here. That turns
// out to be convenient: Next reads .env.local, while Prisma historically only
// ever read .env. Loading it explicitly keeps both on one file.
config({ path: '.env.local', quiet: true })

// Printed on every prisma command, so it is obvious which branch is about to be
// migrated. The branch name is safe to print; the connection string is not.
console.log(`prisma: targeting the ${databaseBranch()} branch`)

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: migrationDatabaseUrl() },
})
