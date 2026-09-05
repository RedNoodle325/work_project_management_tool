import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { downloadFile } from '@/lib/storage'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; path: string[] }> }
) {
  const auth = await requireAuth(req)
  if (auth.error) return auth.error

  const { namespace, path } = await params
  if (!namespace || !path.length || path.some(part => part === '..')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
  }

  try {
    const object = await downloadFile(namespace, path.join('/'))
    if (!object.Body) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const bytes = await object.Body.transformToByteArray()
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return new NextResponse(body, {
      headers: {
        'Content-Type': object.ContentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    console.error('Storage download failed', error)
    return NextResponse.json({ error: 'Unable to retrieve file' }, { status: 500 })
  }
}
