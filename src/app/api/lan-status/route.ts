import { NextResponse } from 'next/server'
import { lanBridge } from '@/lib/lan-bridge-core'

export const runtime = 'nodejs'

export async function GET() {
  const status = lanBridge.getStatus()

  return NextResponse.json({
    success: true,
    data: status,
  })
}
