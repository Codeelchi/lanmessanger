import { NextRequest, NextResponse } from 'next/server'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/chat/pin-message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messageId, roomId, userId } = body

    if (!messageId || !roomId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing messageId, roomId, or userId' },
        { status: 400 }
      )
    }

    // Get the message content for the pin
    const existing = chatBus.getPinnedMessage(roomId)

    // For pinning, we need to store message data. Since the chat bus uses in-memory storage,
    // we fetch the message info from the client and store it.
    // The client sends us the message data in the body.
    const { messageContent, senderName, senderId, timestamp } = body

    const entry = chatBus.pinMessage(roomId, {
      id: messageId,
      roomId,
      sender: senderId ? { id: senderId, displayName: senderName, username: senderName } : null,
      content: messageContent || '',
      type: 'text',
      timestamp: timestamp || new Date().toISOString(),
    }, userId)

    // Emit pin event to all subscribers
    chatBus.emit('message-pinned', {
      roomId,
      message: entry.message,
      pinnedBy: userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Pin message error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to pin message' },
      { status: 500 }
    )
  }
}
