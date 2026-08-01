import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/generated/prisma/client'

import { databaseUrl } from './env'

/**
 * A single Prisma client for the whole process.
 *
 * Next's dev server re-evaluates modules on every edit. Without stashing the
 * client somewhere that survives a reload, each save would build a fresh
 * connection pool and the old ones would linger until Postgres refused new
 * connections. `globalThis` survives; module scope does not. In production the
 * process is not reloaded, so the global is left alone.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl() }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
