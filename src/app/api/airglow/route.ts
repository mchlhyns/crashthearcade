import { NextRequest, NextResponse } from 'next/server'

interface AirglowPayload {
  did: string
  collection: string
  rkey: string
  record: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  let payload: AirglowPayload

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { did, collection, rkey, record } = payload

  if (!did || !collection || !rkey || !record) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supported = [
    'com.crashthearcade.game',
    'com.crashthearcade.list',
    'com.crashthearcade.follow',
    'com.crashthearcade.settings',
  ]

  if (!supported.includes(collection)) {
    return NextResponse.json({ error: 'Unsupported lexicon' }, { status: 400 })
  }

  // Handle each lexicon type
  switch (collection) {
    case 'com.crashthearcade.game':
      // e.g. trigger notifications, update leaderboards, sync external services
      break
    case 'com.crashthearcade.list':
      break
    case 'com.crashthearcade.follow':
      break
    case 'com.crashthearcade.settings':
      break
  }

  return NextResponse.json({ ok: true })
}
