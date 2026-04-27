import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { senderId, type = 'private', recipientUsername, roomId, content, replyToId, fileUrl, fileName, fileType } = body

    if (!senderId || (!content && !fileUrl)) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Get sender info
    const sender = await db.user.findUnique({ where: { id: senderId } })
    if (!sender) {
      return NextResponse.json({ success: false, error: 'Sender not found' }, { status: 404 })
    }

    let targetRoomId = roomId

    if (type === 'private' && recipientUsername) {
      // Find or create recipient
      const recipient = await db.user.upsert({
        where: { username: recipientUsername },
        update: {},
        create: { username: recipientUsername, displayName: recipientUsername },
      })

      // Find or create private room
      const existingRooms = await db.chatRoomMember.findMany({
        where: { userId: senderId },
        include: { room: { include: { members: true } } },
      })

      let privateRoom = existingRooms.find((m) => {
        if (m.room.type !== 'private') return false
        return m.room.members.some((mem) => mem.userId === recipient.id)
      })?.room

      if (!privateRoom) {
        privateRoom = await db.chatRoom.create({
          data: {
            type: 'private',
            name: '',
            members: {
              create: [
                { userId: senderId, role: 'member' },
                { userId: recipient.id, role: 'member' },
              ],
            },
          },
          include: { members: { include: { user: true } } },
        })
      }

      targetRoomId = privateRoom.id
    } else if (type === 'group' && roomId) {
      targetRoomId = roomId
    } else if (type === 'broadcast') {
      // Get or create broadcast room
      let broadcastRoom = await db.chatRoom.findFirst({ where: { type: 'broadcast' } })
      if (!broadcastRoom) {
        broadcastRoom = await db.chatRoom.create({
          data: { name: 'Broadcast', type: 'broadcast', description: 'System-wide broadcast' },
        })
      }
      targetRoomId = broadcastRoom.id
    }

    if (!targetRoomId) {
      return NextResponse.json({ success: false, error: 'Could not determine room' }, { status: 400 })
    }

    // Determine message type based on file
    const isImage = fileType === 'image' || /^image\//.test(fileType || '')
    const messageType = fileUrl && !isImage ? 'file' : 'text'

    // Store message
    const messageData: {
      roomId: string
      senderId: string
      content: string
      type: string
      status: string
      fileUrl?: string
      fileName?: string
      replyToId?: string
    } = {
      roomId: targetRoomId,
      senderId,
      content: content || '',
      type: messageType,
      status: 'delivered',
    }

    if (fileUrl) {
      messageData.fileUrl = fileUrl
      messageData.fileName = fileName || ''
    }

    if (replyToId) {
      messageData.replyToId = replyToId
    }

    // Create message without include to avoid stale Prisma cache
    const message = await db.message.create({
      data: messageData,
    })

    // Fetch sender and reply data manually
    const senderInfo = {
      id: sender.id,
      username: sender.username,
      displayName: sender.displayName,
      avatar: sender.avatar,
    }

    let replyToInfo: Record<string, unknown> | null = null
    if (message.replyToId) {
      const replyMsg = await db.message.findUnique({
        where: { id: message.replyToId },
        select: { id: true, content: true, deletedAt: true, senderId: true },
      })
      if (replyMsg) {
        const replySender = replyMsg.senderId
          ? await db.user.findUnique({ where: { id: replyMsg.senderId }, select: { id: true, username: true, displayName: true, avatar: true } })
          : null
        replyToInfo = {
          id: replyMsg.id,
          content: replyMsg.deletedAt ? 'This message was deleted' : replyMsg.content,
          sender: replySender,
          deletedAt: replyMsg.deletedAt?.toISOString() || null,
        }
      }
    }

    const formattedMessage = {
      id: message.id,
      roomId: message.roomId,
      sender: senderInfo,
      content: message.content,
      type: message.type,
      fileUrl: message.fileUrl || '',
      fileName: message.fileName || '',
      fileType: fileType || '',
      status: message.status,
      timestamp: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() || null,
      replyTo: replyToInfo,
    }

    // Broadcast via SSE to all connected users
    chatBus.emit('message', formattedMessage)

    return NextResponse.json({ success: true, data: { message: formattedMessage } })
  } catch (error) {
    console.error('[chat/send] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
  }
}
