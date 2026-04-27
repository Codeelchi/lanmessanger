import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/chat/update-profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, displayName } = body

    if (!userId || !displayName) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or displayName' },
        { status: 400 }
      )
    }

    if (typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Invalid displayName' },
        { status: 400 }
      )
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { displayName: displayName.trim() },
    })

    return NextResponse.json({
      success: true,
      data: { user },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
