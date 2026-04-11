'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { COLLECTION, SETTINGS_COLLECTION, restoreSession } from '@/lib/atproto'
import { GameRecordView, GameRef, GameStatus } from '@/types/minimap'
import { statusLabel } from '@/lib/igdb'
import GameCard from '@/components/GameCard'

const ALL_STATUSES: GameStatus[] = ['wishlist', 'backlogged', 'started', 'finished', 'shelved', 'abandoned']

function extractCid(ref: unknown): string | null {
  if (!ref) return null
  if (typeof (ref as any)['$link'] === 'string') return (ref as any)['$link']
  if (typeof (ref as any)['/'] === 'string') return (ref as any)['/']
  const s = (ref as any).toString?.()
  if (typeof s === 'string' && s !== '[object Object]') return s
  return null
}

function blobUrl(pdsUrl: string, did: string, blob: unknown): string | null {
  const cid = extractCid((blob as any)?.ref)
  if (!cid) return null
  return `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
}

async function fetchPublicGames(handle: string): Promise<{ resolvedHandle: string; records: GameRecordView[]; displayName?: string; bskyDisplayName?: string; avatar?: string; ctaAvatarUrl?: string; bannerUrl?: string; profileView: 'list' | 'grid'; favouriteGame?: GameRef }> {
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

  // Fetch settings (display name, profile view preference, avatar/banner blobs)
  let displayName: string | undefined
  let profileView: 'list' | 'grid' = 'list'
  let ctaAvatarUrl: string | undefined
  let bannerUrl: string | undefined
  let favouriteGame: GameRef | undefined
  try {
    const settingsRes = await fetch(
      `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${SETTINGS_COLLECTION}&rkey=self`
    )
    if (settingsRes.ok) {
      const settings = await settingsRes.json()
      displayName = settings.value?.displayName
      profileView = settings.value?.profileView ?? 'list'
      if (settings.value?.avatarBlob) ctaAvatarUrl = blobUrl(pdsUrl, did, settings.value.avatarBlob) ?? undefined
      if (settings.value?.bannerBlob) bannerUrl = blobUrl(pdsUrl, did, settings.value.bannerBlob) ?? undefined
      if (settings.value?.favouriteGame) favouriteGame = settings.value.favouriteGame
    }
  } catch {
    // No settings — use defaults
  }

  // Fetch Bluesky profile for avatar and display name fallback
  let bskyDisplayName: string | undefined
  let avatar: string | undefined
  try {
    const profileRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`
    )
    if (profileRes.ok) {
      const profile = await profileRes.json()
      bskyDisplayName = profile.displayName
      avatar = profile.avatar
    }
  } catch {
    // Fall back gracefully
  }

  return { resolvedHandle, records: records as GameRecordView[], displayName, bskyDisplayName, avatar, ctaAvatarUrl, bannerUrl, profileView, favouriteGame }
}

export default function ProfilePage() {
  const params = useParams()
  const handle = typeof params.handle === 'string' ? params.handle : ''

  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [games, setGames] = useState<GameRecordView[]>([])
  const [favouriteGame, setFavouriteGame] = useState<GameRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<GameStatus | 'all'>('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    restoreSession().then((s) => setIsLoggedIn(!!s)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!handle) return
    setLoading(true)
    setError(null)
    fetchPublicGames(handle)
      .then(({ resolvedHandle, records, displayName, bskyDisplayName, avatar, ctaAvatarUrl, bannerUrl, profileView, favouriteGame }) => {
        setResolvedHandle(resolvedHandle)
        setDisplayName(displayName ?? bskyDisplayName ?? null)
        setAvatar(ctaAvatarUrl ?? avatar ?? null)
        setBannerUrl(bannerUrl ?? null)
        setGames(records)
        setView(profileView)
        setFavouriteGame(favouriteGame ?? null)
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

  const filteredGames = (filterStatus === 'all' ? deduped : deduped.filter((g) => g.value.status === filterStatus))
    .sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))

  const countFor = (s: GameStatus) => deduped.filter((g) => g.value.status === s).length

  return (
    <>
      <header>
        <div className="container">
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <a href={isLoggedIn ? '/home' : '/'} className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isLoggedIn ? 'Home' : 'Sign in'}
            {isLoggedIn ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            )}
          </a>
        </div>
      </header>

      <main>
        {!loading && !error && (
          <div className="profile-banner-block">
            {bannerUrl && <div className="profile-banner-bg" style={{ backgroundImage: `url(${bannerUrl})` }} />}
            <div className="container profile-banner-content">
              {avatar && <img src={avatar} alt="" className="profile-banner-avatar" />}
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{displayName ?? `@${resolvedHandle ?? handle}`}</h1>
                {displayName && <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 10 }}>@{resolvedHandle ?? handle}</p>}
              </div>
              {favouriteGame && (
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Favourite game</span>
                      <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{favouriteGame.title}</div>
                      {favouriteGame.releaseYear && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{favouriteGame.releaseYear}</div>
                      )}
                    </div>
                    {favouriteGame.coverUrl
                      ? <img src={favouriteGame.coverUrl} alt={favouriteGame.title} style={{ width: 52, height: 70, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
                      : <img src="/no-cover.png" alt={favouriteGame.title} style={{ width: 52, height: 70, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
              <div className="filter-tabs">
                <button
                  className={`filter-tab${filterStatus === 'all' ? ' active' : ''}`}
                  onClick={() => setFilterStatus('all')}
                >
                  All ({deduped.length})
                </button>
                {ALL_STATUSES.filter((s) => countFor(s) > 0).map((s) => (
                  <button
                    key={s}
                    className={`filter-tab${filterStatus === s ? ' active' : ''}`}
                    onClick={() => setFilterStatus(s)}
                  >
                    {statusLabel(s)} ({countFor(s)})
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
