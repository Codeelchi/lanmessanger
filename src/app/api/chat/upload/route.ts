import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'

const UPLOAD_DIR = 'public/uploads'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 10 MB)' }, { status: 400 })
    }

    // Sanitize file name — keep original extension, generate safe name
    const ext = file.name.split('.').pop() || 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filePath = join(process.cwd(), UPLOAD_DIR, safeName)

    await mkdir(join(process.cwd(), UPLOAD_DIR), { recursive: true })
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const isImage = /^image\//.test(file.type)
    const fileUrl = `/uploads/${safeName}`

    return NextResponse.json({
      success: true,
      data: {
        fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        isImage,
      },
    })
  } catch (error) {
    console.error('[chat/upload] Error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}
