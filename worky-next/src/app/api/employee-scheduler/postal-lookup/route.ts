import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'

type PostalPlace = {
  latitude?: string
  longitude?: string
  'place name'?: string
  'state abbreviation'?: string
}

type PostalResponse = {
  'post code'?: string
  places?: PostalPlace[]
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { allowScheduler: true })
  if (auth.error) return auth.error

  const body = await request.json().catch(() => null)
  const postalCode = typeof body?.postalCode === 'string' ? body.postalCode.trim().toUpperCase() : ''
  const compactPostal = postalCode.replace(/\s+/g, '')
  const usPostal = compactPostal.match(/^(\d{5})(?:-?(\d{4}))?$/)
  const usZip = usPostal?.[1]
  const canadianPostal = compactPostal.match(/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z](?:\d[ABCEGHJ-NPRSTV-Z]\d)?$/)?.[0]
  const country = usZip ? 'us' : canadianPostal ? 'ca' : ''
  const lookupCode = usZip || canadianPostal?.slice(0, 3) || ''
  const normalizedPostal = usPostal
    ? `${usPostal[1]}${usPostal[2] ? `-${usPostal[2]}` : ''}`
    : (canadianPostal && canadianPostal.length === 6 ? `${canadianPostal.slice(0, 3)} ${canadianPostal.slice(3)}` : canadianPostal) || ''
  if (!country || !lookupCode) {
    return NextResponse.json({ error: 'Enter a valid U.S. ZIP code or Canadian postal code.' }, { status: 400 })
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/${country}/${encodeURIComponent(lookupCode)}`, {
      cache: 'force-cache',
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'That ZIP code could not be located.' }, { status: 404 })
    }

    const result = await response.json() as PostalResponse
    const place = result.places?.[0]
    const latitude = Number(place?.latitude)
    const longitude = Number(place?.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'Coordinates are unavailable for that ZIP code.' }, { status: 422 })
    }

    return NextResponse.json({
      postalCode: normalizedPostal || result['post code'] || lookupCode,
      country: country.toUpperCase(),
      latitude,
      longitude,
      city: place?.['place name'] || '',
      state: place?.['state abbreviation'] || '',
    })
  } catch {
    return NextResponse.json({ error: 'ZIP lookup is temporarily unavailable.' }, { status: 503 })
  }
}
