import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messageId, senderId } = body

    if (!messageId || !senderId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Find the message
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } },
    })

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 })
    }

    // Verify sender
    if (message.senderId !== senderId) {
      return NextResponse.json({ success: false, error: 'Not authorized to delete this message' }, { status: 403 })
    }

    // Soft delete
    const deleted = await db.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } },
    })

    const formattedMessage = {
      id: deleted.id,
      roomId: deleted.roomId,
      sender: deleted.sender
        ? { id: deleted.sender.id, username: deleted.sender.username, displayName: deleted.sender.displayName, avatar: deleted.sender.avatar }
        : null,
      content: 'This message was deleted',
      type: 'system',
      fileUrl: '',
      fileName: '',
      status: deleted.status,
      timestamp: deleted.createdAt.toISOString(),
      deletedAt: deleted.deletedAt?.toISOString() || null,
    }

    // Broadcast via SSE
    chatBus.emit('message-deleted', formattedMessage)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[chat/delete-message] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete message' }, { status: 500 })
  }
}
