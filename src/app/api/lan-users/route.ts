import { NextResponse } from 'next/server'
import { lanBridge } from '@/lib/lan-bridge-core'

export async function GET() {
  const status = lanBridge.getStatus()

  if (!status.running) {
    return NextResponse.json({
      success: true,
      data: [],
      bridgeRunning: false,
    })
  }

  const users = lanBridge.getUsers()

  return NextResponse.json({
    success: true,
    data: users,
    bridgeRunning: true,
  })
}
