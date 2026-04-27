import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messageId, newContent, senderId } = body

    if (!messageId || !newContent || !senderId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (!newContent.trim()) {
      return NextResponse.json({ success: false, error: 'Content cannot be empty' }, { status: 400 })
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
      return NextResponse.json({ success: false, error: 'Not authorized to edit this message' }, { status: 403 })
    }

    // Check if deleted
    if (message.deletedAt) {
      return NextResponse.json({ success: false, error: 'Cannot edit a deleted message' }, { status: 400 })
    }

    // Check 5-minute window
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    if (new Date(message.createdAt) < fiveMinutesAgo) {
      return NextResponse.json({ success: false, error: 'Message can only be edited within 5 minutes' }, { status: 400 })
    }

    // Update message
    const updated = await db.message.update({
      where: { id: messageId },
      data: {
        content: newContent.trim(),
        editedAt: new Date(),
      },
      include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } },
    })

    const formattedMessage = {
      id: updated.id,
      roomId: updated.roomId,
      sender: updated.sender
        ? { id: updated.sender.id, username: updated.sender.username, displayName: updated.sender.displayName, avatar: updated.sender.avatar }
        : null,
      content: updated.content,
      type: updated.type,
      fileUrl: updated.fileUrl || '',
      fileName: updated.fileName || '',
      status: updated.status,
      timestamp: updated.createdAt.toISOString(),
      editedAt: updated.editedAt?.toISOString() || null,
    }

    // Broadcast via SSE
    chatBus.emit('message-edited', formattedMessage)

    return NextResponse.json({ success: true, data: { message: formattedMessage } })
  } catch (error) {
    console.error('[chat/edit-message] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to edit message' }, { status: 500 })
  }
}
