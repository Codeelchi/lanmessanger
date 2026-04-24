import { NextRequest, NextResponse } from 'next/server'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, username, roomId } = body

    if (!userId || !roomId) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    chatBus.emit('user-typing', { userId, username, roomId })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
