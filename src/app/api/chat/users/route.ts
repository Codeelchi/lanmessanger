import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const allUsers = await db.user.findMany({
      where: { isSystem: false },
      orderBy: { createdAt: 'asc' },
    })

    const onlineUsernames = chatBus.getOnlineUsernames()

    const users = allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      status: onlineUsernames.includes(u.username) ? 'online' : u.status,
      lastSeen: u.lastSeen?.toISOString(),
    }))

    return NextResponse.json({ success: true, data: { users } })
  } catch (error) {
    console.error('[chat/users] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load users' }, { status: 500 })
  }
}
