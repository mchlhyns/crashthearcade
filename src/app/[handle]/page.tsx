'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { COLLECTION } from '@/lib/atproto'
import { GameRecordView, GameStatus } from '@/types/minimap'
import GameCard from '@/components/GameCard'

const ALL_STATUSES: GameStatus[] = ['started', 'backlogged', 'wishlist', 'shelved', 'finished', 'abandoned']

async function fetchPublicGames(handle: string): Promise<{ resolvedHandle: string; records: GameRecordView[] }> {
  const cleanHandle = handle.replace(/^@/, '')

  // Resolve handle → DID
  const resolveRes = await fetch(
    `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`
  )
  if (!resolveRes.ok) throw new Error('Handle not found')
  const { did } = await resolveRes.json()

  // Resolve DID → PDS endpoint via DID document
  let pdsUrl = 'https://bsky.social'
  try {
    const didDocUrl = did.startsWith('did:web:')
      ? `https://${did.slice('did:web:'.length)}/.well-known/did.json`
      : `https://plc.directory/${did}`
    const didRes = await fetch(didDocUrl)
    if (didRes.ok) {
      const didDoc = await didRes.json()
      const pdsService = didDoc.service?.find((s: { id: string; serviceEndpoint: string }) => s.id === '#atproto_pds')
      if (pdsService?.serviceEndpoint) pdsUrl = pdsService.serviceEndpoint
    }
  } catch {
    // Fall back to bsky.social
  }

  // Fetch public records from their PDS
  const recordsRes = await fetch(
    `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${COLLECTION}&limit=100`
  )
  if (!recordsRes.ok) throw new Error('Failed to fetch games')
  const { records } = await recordsRes.json()

  // Resolve the canonical handle from the repo description
  let resolvedHandle = cleanHandle
  try {
    const descRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`)
    if (descRes.ok) {
      const desc = await descRes.json()
      resolvedHandle = desc.handle ?? cleanHandle
    }
  } catch {
    // Use the handle as-is
  }

  return { resolvedHandle, records: records as GameRecordView[] }
}

export default function ProfilePage() {
  const params = useParams()
  const handle = typeof params.handle === 'string' ? params.handle : ''

  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null)
  const [games, setGames] = useState<GameRecordView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<GameStatus | 'all'>('all')
  const [view, setView] = useState<'list' | 'grid'>('list')

  useEffect(() => {
    if (!handle) return
    setLoading(true)
    setError(null)
    fetchPublicGames(handle)
      .then(({ resolvedHandle, records }) => {
        setResolvedHandle(resolvedHandle)
        setGames(records)
      })
      .catch((err) => setError(err.message ?? 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [handle])

  // Deduplicate by igdbId, keeping the most recent record per game
  const deduped = Object.values(
    games.reduce<Record<number, GameRecordView>>((acc, record) => {
      const id = record.value.game.igdbId
      if (!acc[id] || record.value.createdAt > acc[id].value.createdAt) {
        acc[id] = record
      }
      return acc
    }, {})
  )

  const filtered = filterStatus === 'all' ? deduped : deduped.filter((g) => g.value.status === filterStatus)

  const filteredGames =
    filterStatus === 'wishlist'
      ? [...filtered].sort((a, b) => {
          const ag = a.value.game
          const bg = b.value.game
          const av = ag.releaseDate ?? (ag.releaseYear != null ? ag.releaseYear * 1e7 : Infinity)
          const bv = bg.releaseDate ?? (bg.releaseYear != null ? bg.releaseYear * 1e7 : Infinity)
          return av - bv
        })
      : filtered

  const countFor = (s: GameStatus) => deduped.filter((g) => g.value.status === s).length

  return (
    <>
      <header>
        <div className="container">
          <a href="/" className="wordmark" style={{ textDecoration: 'none' }}>CRASH THE ARCADE</a>
          <a href="/" className="btn btn-ghost btn-sm">Sign in</a>
        </div>
      </header>

      <main>
        <div className="container">
          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : error ? (
            <div className="empty-state">
              <h3>Not found</h3>
              <p>Could not load games for @{handle}. Make sure the handle is correct.</p>
            </div>
          ) : (
            <>
              <div className="page-header">
                <div>
                  <h1>@{resolvedHandle ?? handle}</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>
                    {deduped.length} {deduped.length === 1 ? 'game' : 'games'}
                  </p>
                </div>
                <div className="view-toggle">
                  <button className={`view-toggle-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view">☰</button>
                  <button className={`view-toggle-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view">⊞</button>
                </div>
              </div>

              <div className="filter-tabs">
                <button
                  className={`filter-tab${filterStatus === 'all' ? ' active' : ''}`}
                  onClick={() => setFilterStatus('all')}
                >
                  All ({deduped.length})
                </button>
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`filter-tab${filterStatus === s ? ' active' : ''}`}
                    onClick={() => setFilterStatus(s)}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)} ({countFor(s)})
                  </button>
                ))}
              </div>

              {filteredGames.length === 0 ? (
                <div className="empty-state">
                  <h3>{filterStatus === 'all' ? 'No games yet' : `No ${filterStatus} games`}</h3>
                  <p>{filterStatus === 'all' ? 'Nothing here yet.' : 'Try a different filter.'}</p>
                </div>
              ) : (
                <div className={view === 'grid' ? 'game-grid' : 'game-list'}>
                  {filteredGames.map((record) => (
                    <GameCard
                      key={record.uri}
                      record={record}
                      view={view}
                      readonly
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  )
}
