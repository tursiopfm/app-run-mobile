import { NextRequest, NextResponse } from 'next/server'
import { fetchOpenMeteo } from '@/lib/weather/open-meteo'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '')

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'invalid_coords' }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'out_of_range' }, { status: 400 })
  }

  try {
    const data = await fetchOpenMeteo(lat, lng)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: 'fetch_failed', detail: String(e?.message ?? e) }, { status: 502 })
  }
}
