import { NextRequest, NextResponse } from 'next/server'
import { getIgdbToken, igdbQuery } from '@/lib/igdb-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  if (!rateLimit(`trending:${getClientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const token = await getIgdbToken()
    const now = Math.floor(Date.now() / 1000)
    const twelveMonthsAgo = now - 60 * 60 * 24 * 365
    const thirtyDaysAgo = now - 60 * 60 * 24 * 30

    const [upcoming, recentlyReleased, highlyRated] = await Promise.all([
      igdbQuery(token, 'games',
        `fields name,url,cover.url,first_release_date,platforms.name,hypes; where first_release_date > ${now} & version_parent = null & hypes != null; sort hypes desc; limit 12;`
      ),
      igdbQuery(token, 'games',
        `fields name,url,cover.url,first_release_date,platforms.name,total_rating_count,aggregated_rating_count; where first_release_date > ${thirtyDaysAgo} & first_release_date < ${now} & version_parent = null & (aggregated_rating_count >= 1 | total_rating_count >= 10); sort total_rating_count desc; limit 12;`
      ),
      igdbQuery(token, 'games',
        `fields name,url,cover.url,first_release_date,platforms.name,rating,rating_count; where first_release_date > ${twelveMonthsAgo} & first_release_date < ${now} & rating_count > 20 & version_parent = null; sort rating desc; limit 12;`
      ),
    ])

    const artworkData = await igdbQuery(token, 'artworks',
      `fields image_id; where game.rating > 85 & game.rating_count > 200 & game.version_parent = null; sort game.rating_count desc; limit 100;`
    )

    const artworkUrls: string[] = ((artworkData as { image_id: string }[]) ?? [])
      .map((a) => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${a.image_id}.jpg`)
      .sort(() => Math.random() - 0.5)

    return NextResponse.json({ upcoming, recentlyReleased, highlyRated, artworkUrls }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    console.error('IGDB trending error:', err)
    return NextResponse.json({ error: 'Failed to fetch trending games' }, { status: 500 })
  }
}
