import { NextResponse } from 'next/server'

let cachedToken: { access_token: string; expires_at: number } | null = null

async function getTwitchToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token
  }
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.IGDB_CLIENT_ID!,
      client_secret: process.env.IGDB_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) throw new Error('Failed to get Twitch token')
  const data = await res.json()
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  }
  return cachedToken.access_token
}

async function igdbQuery(token: string, endpoint: string, body: string) {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  })
  if (!res.ok) throw new Error(`IGDB error: ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    const token = await getTwitchToken()
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

    // Fetch artworks from well-known games (high rating, many votes) for a broad pool
    const artworkData = await igdbQuery(token, 'artworks',
      `fields image_id; where game.rating > 85 & game.rating_count > 200 & game.version_parent = null; sort game.rating_count desc; limit 100;`
    )

    // Shuffle so the picked image varies each cache period
    const artworkUrls: string[] = (artworkData ?? [])
      .map((a: { image_id: string }) =>
        `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${a.image_id}.jpg`
      )
      .sort(() => Math.random() - 0.5)

    return NextResponse.json({ upcoming, recentlyReleased, highlyRated, artworkUrls }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    console.error('IGDB trending error:', err)
    return NextResponse.json({ error: 'Failed to fetch trending games' }, { status: 500 })
  }
}
