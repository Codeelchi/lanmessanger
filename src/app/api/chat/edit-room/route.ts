import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/chat/edit-room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roomId, name, description, userId } = body

    if (!roomId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing roomId or userId' },
        { status: 400 }
      )
    }

    // Check that the user is a member of the room
    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    })

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this room' },
        { status: 403 }
      )
    }

    // Build update data
    const updateData: Record<string, string> = {}
    if (typeof name === 'string' && name.trim()) {
      if (name.trim().length > 100) {
        return NextResponse.json(
          { success: false, error: 'Room name must be 100 characters or less' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }
    if (typeof description === 'string') {
      if (description.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Description must be 500 characters or less' },
          { status: 400 }
        )
      }
      updateData.description = description.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update the room
    const updatedRoom = await db.chatRoom.update({
      where: { id: roomId },
      data: updateData,
      include: {
        members: { include: { user: true } },
      },
    })

    // Broadcast room update via SSE
    const formattedRoom = {
      id: updatedRoom.id,
      name: updatedRoom.name,
      type: updatedRoom.type,
      avatar: updatedRoom.avatar,
      description: updatedRoom.description,
      createdAt: updatedRoom.createdAt.toISOString(),
      updatedAt: updatedRoom.updatedAt.toISOString(),
      members: updatedRoom.members.map((mem) => ({
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
    }

    chatBus.emit('room-updated', { room: formattedRoom })

    return NextResponse.json({
      success: true,
      data: { room: formattedRoom },
    })
  } catch (error) {
    console.error('[chat/edit-room] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update room' },
      { status: 500 }
    )
  }
}
