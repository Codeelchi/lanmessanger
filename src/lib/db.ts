import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Ensure the database directory exists before Prisma tries to connect.
// Use absolute path based on process.cwd() to avoid ambiguity
// (Prisma's relative path resolution differs between dev and production builds).
function ensureDbDir(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const relativePath = dbUrl.replace(/^file:/, '')
  const absPath = resolve(process.cwd(), relativePath)
  const dir = dirname(absPath)
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    // Directory might already exist or permissions issue
  }
  return absPath
}

const resolvedDbPath = ensureDbDir()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: `file:${resolvedDbPath}`,
    log: ['error', 'warn'],
  })

// Always preserve the singleton — prevents connection leaks in both dev and production
if (!globalForPrisma.prisma) globalForPrisma.prisma = db