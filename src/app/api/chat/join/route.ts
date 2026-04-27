import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'
import { lanBridge } from '@/lib/lan-bridge-core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface JoinBody {
  username: string
  displayName: string
  status: string
}

export async function POST(request: NextRequest) {
  try {
    const body: JoinBody = await request.json()
    const { username, displayName, status } = body

    if (!username) {
      return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 })
    }

    // Upsert user
    const user = await db.user.upsert({
      where: { username },
      update: {
        displayName: displayName || username,
        status: status || 'online',
        lastSeen: new Date(),
      },
      create: {
        username,
        displayName: displayName || username,
        status: status || 'online',
      },
    })

    // Update LAN Bridge username so LAN Messenger users see our display name
    // and re-announce so they learn about us
    const effectiveName = displayName || username
    lanBridge.setUsername(effectiveName)
    lanBridge.reAnnounce()
    // Also sync status to LAN
    lanBridge.sendStatusUpdate(status || 'online')
    console.log(`[chat/join] Updated LAN Bridge identity: name=${effectiveName}, status=${status || 'online'}, lanUserId=${lanBridge.getLocalUserId()}`)

    // Get all users
    const allUsers = await db.user.findMany({
      where: { isSystem: false },
      orderBy: { createdAt: 'asc' },
    })

    const onlineUsernames = chatBus.getOnlineUsernames()

    const formattedUsers = allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      status: onlineUsernames.includes(u.username) ? 'online' : u.status,
      lastSeen: u.lastSeen?.toISOString(),
    }))

    // Get user's rooms
    const memberships = await db.chatRoomMember.findMany({
      where: { userId: user.id },
      include: {
        room: {
          include: {
            members: { include: { user: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    const rooms = memberships.map((m) => ({
      id: m.room.id,
      name: m.room.name,
      type: m.room.type,
      avatar: m.room.avatar,
      description: m.room.description,
      createdAt: m.room.createdAt.toISOString(),
      updatedAt: m.room.updatedAt.toISOString(),
      members: m.room.members.map((mem) => ({
        userId: mem.userId,
        role: mem.role,
        joinedAt: mem.joinedAt.toISOString(),
        user: {
          id: mem.user.id,
          username: mem.user.username,
          displayName: mem.user.displayName,
          avatar: mem.user.avatar,
          status: mem.user.status,
        },
      })),
      lastMessage: m.room.messages[0]
        ? {
            id: m.room.messages[0].id,
            roomId: m.room.messages[0].roomId,
            sender: m.room.messages[0].sender
              ? {
                  id: m.room.messages[0].sender.id,
                  username: m.room.messages[0].sender.username,
                  displayName: m.room.messages[0].sender.displayName,
                  avatar: m.room.messages[0].sender.avatar,
                }
              : null,
            content: m.room.messages[0].content,
            type: m.room.messages[0].type,
            fileUrl: m.room.messages[0].fileUrl || '',
            fileName: m.room.messages[0].fileName || '',
            status: m.room.messages[0].status,
            timestamp: m.room.messages[0].createdAt.toISOString(),
          }
        : null,
    }))

    // Notify other users
    chatBus.emit('user-joined', {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        status: 'online',
      },
    }, user.id)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          status: user.status,
          lastSeen: user.lastSeen?.toISOString(),
        },
        users: formattedUsers,
        rooms,
      },
    })
  } catch (error) {
    console.error('[chat/join] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to join' }, { status: 500 })
  }
}
