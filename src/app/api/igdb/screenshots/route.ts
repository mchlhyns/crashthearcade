import { NextRequest, NextResponse } from 'next/server'
import { getIgdbToken } from '@/lib/igdb-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function normalizeUrl(url: string) {
  return url.replace(/^\/\//, 'https://').replace(/\/t_[^/]+\//, '/t_screenshot_big/')
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`screenshots:${getClientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({}, { status: 429 })
  }

  const raw = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = raw.split(',').slice(0, 20).map(Number).filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return NextResponse.json({})

  try {
    const token = await getIgdbToken()
    const headers = {
      'Client-ID': process.env.IGDB_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    }
    const idList = ids.join(',')
    const limit = Math.min(ids.length * 3, 50)

    const [screenshotsRes, artworksRes] = await Promise.all([
      fetch('https://api.igdb.com/v4/screenshots', { method: 'POST', headers, body: `fields url,game; where game = (${idList}); limit ${limit};` }),
      fetch('https://api.igdb.com/v4/artworks',    { method: 'POST', headers, body: `fields url,game; where game = (${idList}); limit ${limit};` }),
    ])

    const [screenshots, artworks]: { url: string; game: number }[][] = await Promise.all([
      screenshotsRes.ok ? screenshotsRes.json() : Promise.resolve([]),
      artworksRes.ok   ? artworksRes.json()    : Promise.resolve([]),
    ])

    // Prefer screenshots; fall back to artworks for games with none
    const result: Record<number, string> = {}
    for (const s of [...screenshots, ...artworks]) {
      if (!result[s.game]) result[s.game] = normalizeUrl(s.url)
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('IGDB screenshots error:', err)
    return NextResponse.json({}, { status: 500 })
  }
}
