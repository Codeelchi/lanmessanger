import { NextRequest, NextResponse } from 'next/server'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

// POST /api/chat/unpin-message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roomId } = body

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Missing roomId' },
        { status: 400 }
      )
    }

    chatBus.unpinMessage(roomId)

    // Emit unpin event to all subscribers
    chatBus.emit('message-unpinned', { roomId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unpin message error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to unpin message' },
      { status: 500 }
    )
  }
}
