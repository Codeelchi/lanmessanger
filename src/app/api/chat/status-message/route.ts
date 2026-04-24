import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

// POST /api/chat/status-message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, statusMessage } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Validate status message length
    if (typeof statusMessage === 'string' && statusMessage.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Status message must be 100 characters or less' },
        { status: 400 }
      )
    }

    const trimmedMessage = typeof statusMessage === 'string' ? statusMessage.trim() : ''

    await db.user.update({
      where: { id: userId },
      data: { statusMessage: trimmedMessage || null },
    })

    // Broadcast status message change to all connected users
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, statusMessage: true },
    })

    if (user) {
      chatBus.emit('user-status-changed', {
        userId: user.id,
        statusMessage: user.statusMessage,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[chat/status-message] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update status message' },
      { status: 500 }
    )
  }
}
