import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    const before = request.nextUrl.searchParams.get('before')

    const whereClause: Record<string, unknown> = { roomId }
    if (before) {
      whereClause.createdAt = { lt: new Date(before) }
    }

    // Fetch messages without replyTo include to avoid stale Prisma cache issues
    // Reply data is populated on the client side from SSE events
    const messages = await db.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    })

    // Manually fetch senders in batch
    const senderIds = [...new Set(messages.map((m) => m.senderId).filter(Boolean))]
    const senders = senderIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, username: true, displayName: true, avatar: true },
        })
      : []
    const senderMap = new Map(senders.map((s) => [s.id, s]))

    // Manually fetch reply messages
    const replyToIds = [...new Set(messages.map((m) => m.replyToId).filter(Boolean))]
    const replyMessages = replyToIds.length > 0
      ? await db.message.findMany({
          where: { id: { in: replyToIds } },
          select: { id: true, content: true, deletedAt: true, senderId: true },
        })
      : []
    const replyMap = new Map(replyMessages.map((r) => [r.id, r]))

    // Get sender info for replies
    const replySenderIds = [...new Set(replyMessages.map((r) => r.senderId).filter(Boolean))]
    const replySenders = replySenderIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: replySenderIds } },
          select: { id: true, username: true, displayName: true, avatar: true },
        })
      : []
    const replySenderMap = new Map(replySenders.map((s) => [s.id, s]))

    // Batch fetch all reactions for the loaded messages
    // Use safe access in case Prisma client is stale (Turbopack cache issue)
    const messageIds = messages.map((m) => m.id)
    let allReactions: Array<{ messageId: string; emoji: string; userId: string }> = []
    try {
      if (messageIds.length > 0 && db.messageReaction) {
        allReactions = await db.messageReaction.findMany({
          where: { messageId: { in: messageIds } },
          select: { messageId: true, emoji: true, userId: true },
        })
      }
    } catch {
      // messageReaction model not available in this Prisma client — skip reactions
    }

    // Group reactions by messageId
    const reactionsByMessageId = new Map<string, Array<{ emoji: string; userIds: string[] }>>()
    for (const r of allReactions) {
      const list = reactionsByMessageId.get(r.messageId) || []
      const existing = list.find((entry) => entry.emoji === r.emoji)
      if (existing) {
        existing.userIds.push(r.userId)
      } else {
        list.push({ emoji: r.emoji, userIds: [r.userId] })
      }
      reactionsByMessageId.set(r.messageId, list)
    }

    const formattedMessages = messages.reverse().map((m) => {
      const sender = m.senderId ? senderMap.get(m.senderId) : null
      const reply = m.replyToId ? replyMap.get(m.replyToId) : null
      const msgReactions = reactionsByMessageId.get(m.id) || []

      return {
        id: m.id,
        roomId: m.roomId,
        sender: sender
          ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatar: sender.avatar }
          : null,
        content: m.deletedAt ? 'This message was deleted' : m.content,
        type: m.deletedAt ? 'system' : m.type,
        fileUrl: m.fileUrl || '',
        fileName: m.fileName || '',
        status: m.status,
        timestamp: m.createdAt.toISOString(),
        editedAt: m.editedAt?.toISOString() || null,
        deletedAt: m.deletedAt?.toISOString() || null,
        replyTo: reply
          ? {
              id: reply.id,
              content: reply.deletedAt ? 'This message was deleted' : reply.content,
              sender: reply.senderId ? replySenderMap.get(reply.senderId) || null : null,
              deletedAt: reply.deletedAt?.toISOString() || null,
            }
          : null,
        reactions: msgReactions.map((entry) => ({
          emoji: entry.emoji,
          count: entry.userIds.length,
          userIds: entry.userIds,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        messages: formattedMessages,
        hasMore: messages.length >= limit,
      },
    })
  } catch (error) {
    console.error('[chat/rooms/messages] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load messages' }, { status: 500 })
  }
}
