import { NextRequest, NextResponse } from 'next/server'
import { lanBridge } from '@/lib/lan-bridge-core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Send various commands to a LAN user.
 * Supports: chatstate, userdata, ping, version
 *
 * Body:
 *   lanUserId: string (LAN user id)
 *   command: string ('chatstate' | 'userdata' | 'ping' | 'version')
 *   state?: string (for chatstate: 'composing', 'active', 'paused', 'gone', 'inactive')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lanUserId, command, state } = body

    if (!lanUserId || !command) {
      return NextResponse.json({ success: false, error: 'Missing required fields: lanUserId, command' }, { status: 400 })
    }

    let sent = false

    switch (command) {
      case 'chatstate':
        sent = lanBridge.sendChatState(lanUserId, state || 'active')
        break
      case 'userdata':
        sent = lanBridge.sendUserData(lanUserId)
        break
      case 'ping':
        sent = lanBridge.sendUserData(lanUserId) // sendUserData acts as ping+profile
        break
      case 'version':
        sent = lanBridge.sendVersionResponse(lanUserId)
        break
      default:
        return NextResponse.json({ success: false, error: `Unknown command: ${command}` }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: { sent } })
  } catch (error) {
    console.error('[chat/lan-chatstate] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to execute LAN command' }, { status: 500 })
  }
}
