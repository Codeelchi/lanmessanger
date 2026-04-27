import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { creatorId, name, memberUsernames = [], description } = body

    if (!creatorId || !name) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Validate description length
    if (typeof description === 'string' && description.length > 500) {
      return NextResponse.json({ success: false, error: 'Description must be 500 characters or less' }, { status: 400 })
    }

    // Resolve creator - validate they exist, fallback to lookup
    let resolvedCreatorId = creatorId
    let creatorUser = await db.user.findUnique({ where: { id: creatorId } })
    if (!creatorUser) {
      // Try to find by looking at join data — fallback: check all usernames
      return NextResponse.json({ success: false, error: 'Creator not found. Please re-join the chat.' }, { status: 400 })
    }

    // Ensure all member users exist (deduplicate by resolved IDs)
    const memberIdsSet = new Set<string>([resolvedCreatorId])
    const memberUsernamesSet = new Set<string>([creatorUser.username])
    for (const uname of memberUsernames) {
      if (memberUsernamesSet.has(uname)) continue // Skip duplicate usernames
      memberUsernamesSet.add(uname)
      const memberUser = await db.user.upsert({
        where: { username: uname },
        update: {},
        create: { username: uname, displayName: uname },
      })
      memberIdsSet.add(memberUser.id)
    }
    const memberIds = Array.from(memberIdsSet)

    if (memberIds.length < 2) {
      return NextResponse.json({ success: false, error: 'Group must have at least 2 members' }, { status: 400 })
    }

    // Create group room with transaction
    const room = await db.$transaction(async (tx) => {
      const created = await tx.chatRoom.create({
        data: {
          name,
          type: 'group',
          description: typeof description === 'string' ? description.trim() : '',
        },
        include: { members: { include: { user: true } } },
      })

      // Create members one by one to avoid nested create issues
      for (const userId of memberIds) {
        await tx.chatRoomMember.create({
          data: {
            roomId: created.id,
            userId,
            role: userId === resolvedCreatorId ? 'admin' : 'member',
          },
        }).catch(() => {
          // Ignore unique constraint errors (duplicate member)
        })
      }

      // Re-fetch with members
      return tx.chatRoom.findUniqueOrThrow({
        where: { id: created.id },
        include: { members: { include: { user: true } } },
      })
    })

    // System message
    const systemUser = await db.user.upsert({
      where: { username: '__system__' },
      update: {},
      create: { username: '__system__', displayName: 'System', isSystem: true },
    })

    await db.message.create({
      data: {
        roomId: room.id,
        senderId: systemUser.id,
        content: `${creatorUser.displayName || creatorUser.username} created the group "${name}"`,
        type: 'system',
        status: 'delivered',
      },
    })

    const formattedRoom = {
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
        user: {
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName,
          avatar: m.user.avatar,
          status: m.user.status,
        },
      })),
    }

    // Notify all connected users who are members
    chatBus.emit('room-created', { room: formattedRoom })

    return NextResponse.json({ success: true, data: { room: formattedRoom } })
  } catch (error) {
    console.error('[chat/create-group] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create group' }, { status: 500 })
  }
}
