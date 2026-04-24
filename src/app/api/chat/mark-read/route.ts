import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roomId, userId, lastMessageId } = body

    if (!roomId || !userId || !lastMessageId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user is a member of the room
    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    })

    if (!membership) {
      return NextResponse.json({ success: false, error: 'Not a member of this room' }, { status: 403 })
    }

    // Get messages in room from lastMessageId backwards that this user hasn't read
    // Mark all unread messages as read
    const unreadMessages = await db.message.findMany({
      where: {
        roomId,
        id: { lte: lastMessageId },
        deletedAt: null,
        senderId: { not: userId },
      },
      select: { id: true },
    })

    // Upsert read receipts
    for (const msg of unreadMessages) {
      await db.messageRead.upsert({
        where: { messageId_userId: { messageId: msg.id, userId } },
        update: { readAt: new Date() },
        create: { messageId: msg.id, roomId, userId, readAt: new Date() },
      })
    }

    // Emit read event
    chatBus.emit('message-read', {
      roomId,
      userId,
      lastMessageId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[chat/mark-read] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to mark as read' }, { status: 500 })
  }
}
