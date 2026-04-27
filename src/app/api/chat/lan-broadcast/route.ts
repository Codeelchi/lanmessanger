import { NextRequest, NextResponse } from 'next/server'
import { lanBridge } from '@/lib/lan-bridge-core'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Send a broadcast message to ALL LAN Messenger clients on the network.
 * Also stores the message in the web chat Broadcast room.
 *
 * Body:
 *   senderId: string (web user DB id)
 *   content: string (message text)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { senderId, content } = body

    if (!senderId || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing required fields: senderId, content' }, { status: 400 })
    }

    // Send via UDP to all LAN users
    const sent = lanBridge.sendBroadcastMessage(content.trim())
    if (!sent) {
      return NextResponse.json({ success: false, error: 'LAN bridge not running' }, { status: 503 })
    }

    // Get sender info
    const sender = await db.user.findUnique({ where: { id: senderId } })
    if (!sender) {
      return NextResponse.json({ success: false, error: 'Sender not found' }, { status: 404 })
    }

    // Find or create Broadcast room
    let broadcastRoom = await db.chatRoom.findFirst({ where: { type: 'broadcast' } })
    if (!broadcastRoom) {
      broadcastRoom = await db.chatRoom.create({
        data: { name: 'Broadcast', type: 'broadcast', description: 'System-wide broadcast' },
      })
    }

    // Store message in DB
    const message = await db.message.create({
      data: {
        roomId: broadcastRoom.id,
        senderId,
        content: content.trim(),
        type: 'text',
        status: 'delivered',
      },
    })

    const formattedMessage = {
      id: message.id,
      roomId: message.roomId,
      sender: {
        id: sender.id,
        username: sender.username,
        displayName: sender.displayName,
        avatar: sender.avatar,
      },
      content: message.content,
      type: message.type,
      fileUrl: '',
      fileName: '',
      status: message.status,
      timestamp: message.createdAt.toISOString(),
      editedAt: null,
      replyTo: null,
    }

    chatBus.emit('message', formattedMessage)

    return NextResponse.json({ success: true, data: { message: formattedMessage, roomId: broadcastRoom.id } })
  } catch (error) {
    console.error('[chat/lan-broadcast] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send LAN broadcast' }, { status: 500 })
  }
}
