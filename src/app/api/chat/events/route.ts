import { NextRequest } from 'next/server'
import { chatBus } from '@/lib/chat-bus'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/chat/events - Server-Sent Events endpoint
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  const username = request.nextUrl.searchParams.get('username')

  if (!userId || !username) {
    return new Response('Missing userId or username', { status: 400 })
  }

  // Update user status to online
  try {
    await db.user.update({
      where: { id: userId },
      data: { status: 'online', lastSeen: new Date() },
    })
  } catch {
    // User might not exist yet
  }

  const subscriberId = `${userId}-${Date.now()}`

  const encoder = new TextEncoder()
  let keepAliveInterval: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      controller.enqueue(encoder.encode(`event: connected\ndata: {"userId":"${userId}"}\n\n`))

      // Subscribe to events
      chatBus.subscribe(subscriberId, userId, username, (payload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        } catch {
          chatBus.unsubscribe(subscriberId)
        }
      })

      // Notify others of join
      chatBus.emit('user-joined', { userId, username })

      // Keep-alive every 15s to prevent connection timeout
      keepAliveInterval = setInterval(() => {
        chatBus.touch(subscriberId)
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`))
        } catch {
          if (keepAliveInterval) clearInterval(keepAliveInterval)
          chatBus.unsubscribe(subscriberId)
        }
      }, 15000)
    },
    cancel() {
      if (keepAliveInterval) clearInterval(keepAliveInterval)
      chatBus.unsubscribe(subscriberId)
      // Notify others of leave
      chatBus.emit('user-left', { userId, username })
      // Update user status to offline
      db.user.update({
        where: { id: userId },
        data: { status: 'offline', lastSeen: new Date() },
      }).catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
