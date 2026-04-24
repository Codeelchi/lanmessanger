import { NextRequest, NextResponse } from 'next/server'
import { lanBridge } from '@/lib/lan-bridge-core'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

/**
 * Send a message from a web user to a LAN Messenger user via UDP.
 * Also stores the message in the database so both parties have history.
 *
 * Supports two modes:
 * 1. With content: sends UDP message + creates DM room + stores message
 * 2. Without content (empty string): just creates/ensures DM room (no UDP send, no message stored)
 *
 * Body:
 *   senderId: string (web user DB id)
 *   lanUserId: string (LAN user id, e.g. "2CF05DD2CD79Roser")
 *   content: string (message text, optional — empty = room creation only)
 *   roomId: string (optional, existing DM room id)
 *   lanUserName: string (optional, human-readable name for room display)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { senderId, lanUserId, content, roomId, lanUserName } = body

    if (!senderId || !lanUserId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: senderId, lanUserId' }, { status: 400 })
    }

    const trimmedContent = content?.trim() || ''
    const isRoomCreationOnly = trimmedContent === ''

    // Get sender info
    const sender = await db.user.findUnique({ where: { id: senderId } })
    if (!sender) {
      return NextResponse.json({ success: false, error: 'Sender not found' }, { status: 404 })
    }

    // Get the LAN user's human-readable name from the bridge
    const lanUsers = lanBridge.getUsers()
    const bridgeUser = lanUsers.find((u) => u.id === lanUserId)
    const displayName = lanUserName || bridgeUser?.name || lanUserId

    // Ensure LAN user exists in DB with proper display name
    const lanUsername = `lan-${lanUserId}`
    const lanUser = await db.user.upsert({
      where: { username: lanUsername },
      update: {
        lastSeen: new Date(),
        displayName: displayName,
      },
      create: { username: lanUsername, displayName: displayName, status: 'online' },
    })

    // Find or create DM room between sender and LAN user
    let targetRoomId = roomId

    if (!targetRoomId) {
      // Look for existing private room with the LAN user as member
      const existingMember = await db.chatRoomMember.findFirst({
        where: { userId: lanUser.id },
        include: { room: { include: { members: { include: { user: true } } } } },
      })
      if (existingMember && existingMember.room.type === 'private') {
        targetRoomId = existingMember.roomId
        // Update room name if it still has the raw user ID
        if (existingMember.room.name === `LAN: ${lanUserId}` || existingMember.room.name === `LAN: ${lanUser.displayName}`) {
          await db.chatRoom.update({
            where: { id: targetRoomId },
            data: { name: `LAN: ${displayName}` },
          })
        }
        // Add sender to room if not already a member
        const senderIsMember = existingMember.room.members.some((m) => m.userId === senderId)
        if (!senderIsMember) {
          await db.chatRoomMember.create({
            data: { roomId: targetRoomId, userId: senderId, role: 'member' },
          })
        }
      } else {
        // Create new DM room with human-readable name
        const room = await db.chatRoom.create({
          data: {
            name: `LAN: ${displayName}`,
            type: 'private',
            description: `Direct message with LAN user ${displayName}`,
            members: {
              create: [
                { userId: senderId, role: 'member' },
                { userId: lanUser.id, role: 'member' },
              ],
            },
          },
          include: { members: { include: { user: true } } },
        })
        targetRoomId = room.id

        // Notify SSE clients about the new room
        chatBus.emit('room-created', {
          room: {
            id: room.id,
            name: room.name,
            type: room.type,
            avatar: room.avatar,
            description: room.description,
            createdAt: room.createdAt.toISOString(),
            updatedAt: room.updatedAt.toISOString(),
            members: room.members.map((m) => ({
              userId: m.userId,
              role: m.role,
              joinedAt: m.joinedAt.toISOString(),
              user: { id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, status: m.user.status },
            })),
            lastMessage: null,
          },
        })
      }
    }

    // If room creation only, return the room ID
    if (isRoomCreationOnly) {
      return NextResponse.json({ success: true, data: { roomId: targetRoomId } })
    }

    // Send our profile data to the LAN user before the first message
    // This ensures they can display our name properly
    lanBridge.sendUserData(lanUserId)

    // Send via UDP
    const sent = lanBridge.sendDirectMessage(lanUserId, trimmedContent)
    if (!sent) {
      return NextResponse.json({ success: false, error: 'LAN user not found or bridge not running' }, { status: 404 })
    }

    // Store message in DB
    const message = await db.message.create({
      data: {
        roomId: targetRoomId,
        senderId,
        content: trimmedContent,
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

    return NextResponse.json({ success: true, data: { message: formattedMessage, roomId: targetRoomId } })
  } catch (error) {
    console.error('[chat/send-to-lan] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send LAN message' }, { status: 500 })
  }
}
