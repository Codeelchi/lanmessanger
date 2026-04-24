// instrumentation.ts - Server startup hook
// This runs once when the Next.js server starts (both dev and production).
// It ensures database tables exist before starting the LAN Bridge,
// guaranteeing that Prisma queries never fail with P2021.

export const runtime = 'nodejs'

/**
 * Programmatically create all required tables using raw SQLite SQL.
 * This is the most reliable approach — no dependency on Prisma CLI,
 * npx, or external tools. Works identically in dev, production, and
 * portable deployments regardless of how the database file path is resolved.
 *
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run on every startup.
 * Columns are kept in sync with prisma/schema.prisma manually.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "displayName" TEXT NOT NULL DEFAULT '',
  "avatar" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'online',
  "statusMessage" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT 0,
  "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

CREATE TABLE IF NOT EXISTS "ChatRoom" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'private',
  "avatar" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ChatRoomMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId", "userId");

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "senderId" TEXT,
  "content" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'text',
  "fileUrl" TEXT NOT NULL DEFAULT '',
  "fileName" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'sent',
  "editedAt" DATETIME,
  "deletedAt" DATETIME,
  "replyToId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MessageRead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MessageRead_messageId_userId_key" ON "MessageRead"("messageId", "userId");

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'system',
  "language" TEXT NOT NULL DEFAULT 'en',
  "notifications" BOOLEAN NOT NULL DEFAULT 1,
  "sound" BOOLEAN NOT NULL DEFAULT 1,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSettings_userId_key" ON "UserSettings"("userId");

CREATE TABLE IF NOT EXISTS "MessageReaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");
`

async function ensureDatabase(): Promise<void> {
  try {
    const { db } = await import('./lib/db')
    console.log('[Instrumentation] Ensuring database tables exist...')

    // Execute the raw SQL to create all tables if they don't exist
    // This is the primary mechanism — no CLI tools needed
    const statements = SCHEMA_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const stmt of statements) {
      try {
        await db.$executeRawUnsafe(stmt)
      } catch (err) {
        // Some statements (like CREATE INDEX) might fail if they already exist
        // with a different definition — log but continue
        console.warn('[Instrumentation] SQL statement warning:', (err as Error).message?.substring(0, 100))
      }
    }

    // Verify tables exist
    const tables = await db.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
    console.log(`[Instrumentation] Database ready with ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`)
  } catch (err) {
    console.error('[Instrumentation] CRITICAL: Database setup failed:', (err as Error).message)
    console.error('[Instrumentation] Features requiring the database will not work.')
  }
}

export async function register() {
  // Step 1: Ensure database tables exist before anything else
  await ensureDatabase()

  // Step 2: Start LAN Bridge
  try {
    const { lanBridge } = await import('./lib/lan-bridge-core')
    await lanBridge.start()
    console.log('[Instrumentation] LAN Bridge started successfully')
  } catch (err) {
    console.error('[Instrumentation] LAN Bridge failed to start:', (err as Error).message)
    console.log('[Instrumentation] Continuing without LAN Bridge...')
  }
}
