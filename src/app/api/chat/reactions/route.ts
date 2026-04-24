import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, messageId, userId, emoji } = body

    if (!messageId || !userId || !emoji) {
      return NextResponse.json({ success: false, error: 'Missing required fields: messageId, userId, emoji' }, { status: 400 })
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action. Use "add" or "remove"' }, { status: 400 })
    }

    // Verify message exists
    const message = await db.message.findUnique({ where: { id: messageId } })
    if (!message) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 })
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (action === 'add') {
      // Check if reaction already exists (upsert behavior via unique constraint)
      const existing = await db.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: { messageId, userId, emoji },
        },
      })

      if (existing) {
        return NextResponse.json({ success: false, error: 'Reaction already exists' }, { status: 409 })
      }

      const reaction = await db.messageReaction.create({
        data: { messageId, userId, emoji },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
      })

      // Get all reactions for this message to broadcast updated counts
      const allReactions = await db.messageReaction.findMany({
        where: { messageId },
        include: { user: { select: { id: true } } },
      })

      // Build reaction summary with userIds (client computes 'reacted' per-user)
      const reactionMap = new Map<string, { count: number; userIds: Set<string> }>()
      for (const r of allReactions) {
        const entry = reactionMap.get(r.emoji) || { count: 0, userIds: new Set<string>() }
        entry.count++
        entry.userIds.add(r.userId)
        reactionMap.set(r.emoji, entry)
      }

      const reactionSummary = Array.from(reactionMap.entries()).map(([e, data]) => ({
        emoji: e,
        count: data.count,
        userIds: Array.from(data.userIds),
      }))

      // Broadcast via SSE
      chatBus.emit('reaction-added', {
        messageId,
        roomId: message.roomId,
        userId,
        username: user.username,
        displayName: user.displayName,
        emoji,
        reactions: reactionSummary,
      }, userId)

      return NextResponse.json({
        success: true,
        data: {
          reaction: {
            id: reaction.id,
            messageId: reaction.messageId,
            userId: reaction.userId,
            username: reaction.user.username,
            displayName: reaction.user.displayName,
            emoji: reaction.emoji,
            createdAt: reaction.createdAt,
          },
          reactions: reactionSummary,
        },
      })
    }

    // action === 'remove'
    const deleted = await db.messageReaction.deleteMany({
      where: { messageId, userId, emoji },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: 'Reaction not found' }, { status: 404 })
    }

    // Get all remaining reactions for this message
    const allReactions = await db.messageReaction.findMany({
      where: { messageId },
      include: { user: { select: { id: true } } },
    })

    const reactionMap = new Map<string, { count: number; userIds: Set<string> }>()
    for (const r of allReactions) {
      const entry = reactionMap.get(r.emoji) || { count: 0, userIds: new Set<string>() }
      entry.count++
      entry.userIds.add(r.userId)
      reactionMap.set(r.emoji, entry)
    }

    const reactionSummary = Array.from(reactionMap.entries()).map(([e, data]) => ({
      emoji: e,
      count: data.count,
      userIds: Array.from(data.userIds),
    }))

    // Broadcast via SSE
    chatBus.emit('reaction-removed', {
      messageId,
      roomId: message.roomId,
      userId,
      username: user.username,
      emoji,
      reactions: reactionSummary,
    }, userId)

    return NextResponse.json({
      success: true,
      data: { messageId, userId, emoji, action: 'removed', reactions: reactionSummary },
    })
  } catch (error) {
    console.error('Reaction API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
