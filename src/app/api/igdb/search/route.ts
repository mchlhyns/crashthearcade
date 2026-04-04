import { NextRequest, NextResponse } from 'next/server'

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
    // Expire 5 minutes early to be safe
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  }
  return cachedToken.access_token
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ games: [] })
  }

  try {
    const token = await getTwitchToken()
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: `fields name,cover.url,first_release_date,platforms.name,summary; search "${query.replace(/"/g, '')}"; limit 15; where version_parent = null;`,
    })

    if (!res.ok) throw new Error('IGDB request failed')

    const games = await res.json()
    return NextResponse.json({ games })
  } catch (err) {
    console.error('IGDB search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
