import { NextRequest, NextResponse } from 'next/server'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/chat/bookmark-message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, messageId, action } = body

    if (!userId || !messageId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing userId, messageId, or action' },
        { status: 400 }
      )
    }

    if (action === 'bookmark') {
      const added = chatBus.bookmarkMessage(userId, messageId)
      return NextResponse.json({ success: true, data: { bookmarked: added } })
    }

    if (action === 'unbookmark') {
      const removed = chatBus.unbookmarkMessage(userId, messageId)
      return NextResponse.json({ success: true, data: { bookmarked: !removed } })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "bookmark" or "unbookmark".' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[chat/bookmark-message] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to bookmark message' },
      { status: 500 }
    )
  }
}

// GET /api/chat/bookmark-message?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      )
    }

    const bookmarkIds = chatBus.getUserBookmarks(userId)
    return NextResponse.json({ success: true, data: { bookmarkIds } })
  } catch (error) {
    console.error('[chat/bookmark-message] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get bookmarks' },
      { status: 500 }
    )
  }
}
