import { NextRequest, NextResponse } from 'next/server'
import { lanBridge } from '@/lib/lan-bridge-core'
import { chatBus } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'

/**
 * Sync a web user's status change to the LAN network.
 * Also syncs display name and custom note.
 *
 * Body:
 *   status: string (online/away/busy/dnd/gone)
 *   displayName?: string (updated display name)
 *   note?: string (custom status message)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { status, displayName, note } = body

    const results: Record<string, boolean> = {}

    // Update display name in LAN bridge
    if (displayName?.trim()) {
      results.username = lanBridge.setUsername(displayName.trim())
    }

    // Send status update to LAN
    if (status) {
      results.status = lanBridge.sendStatusUpdate(status)
      // Also emit to local SSE clients
      chatBus.emit('user-status-changed', { status })
    }

    // Send note/status message to LAN
    if (note !== undefined) {
      results.note = lanBridge.sendNoteUpdate(note || '')
    }

    const anySent = Object.values(results).some(Boolean)

    return NextResponse.json({
      success: true,
      data: {
        sent: anySent,
        results,
      },
    })
  } catch (error) {
    console.error('[chat/lan-status-update] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update LAN status' }, { status: 500 })
  }
}
