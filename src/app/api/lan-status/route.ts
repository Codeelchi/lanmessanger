import { NextResponse } from 'next/server'
import { lanBridge } from '@/lib/lan-bridge-core'

export async function GET() {
  const status = lanBridge.getStatus()

  return NextResponse.json({
    success: true,
    data: status,
  })
}
