import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, status } = body

    if (!userId || !status) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    const validStatuses = ['online', 'away', 'busy']
    const newStatus = validStatuses.includes(status) ? status : 'online'

    await db.user.update({ where: { id: userId }, data: { status: newStatus } })

    chatBus.emit('user-status-changed', { userId, status: newStatus })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[chat/status] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 })
  }
}
