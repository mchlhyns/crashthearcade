'use client'

import { useEffect, useRef, useState } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut, COLLECTION, FOLLOW_COLLECTION } from '@/lib/atproto'
import { GameRecordView, GameStatus } from '@/types'
import { Stars } from '@/components/Stars'
import AddGameModal from '@/components/AddGameModal'
import HeaderMenu from '@/components/HeaderMenu'
import MobileMenu from '@/components/MobileMenu'
import NavDropdown from '@/components/NavDropdown'

interface FollowProfile {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  followUri: string
}

interface SearchActor {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

interface FeedItem {
  userHandle: string
  displayName: string | null
  avatar: string | null
  gameTitle: string
  gameCoverUrl: string | null
  igdbId: number
  status: GameStatus
  rating?: number
  createdAt: string
}

function feedActionText(status: GameStatus): string {
  switch (status) {
    case 'started': return 'started playing'
    case 'finished': return 'finished'
    case 'backlogged': return 'backlogged'
    case 'shelved': return 'shelved'
    case 'abandoned': return 'abandoned'
    case 'wishlist': return 'wishlisted'
  }
}

async function getPdsFromDid(did: string): Promise<string> {
  try {
    if (did.startsWith('did:web:')) {
      const host = did.slice('did:web:'.length).split(':')[0]
      return `https://${host}`
    }
    const doc = await fetch(`https://plc.directory/${encodeURIComponent(did)}`)
    if (!doc.ok) return 'https://bsky.social'
    const { service } = await doc.json()
    const pds = (service ?? []).find((s: { id: string; serviceEndpoint: string }) => s.id === '#atproto_pds')
    if (pds?.serviceEndpoint && new URL(pds.serviceEndpoint).protocol === 'https:') return pds.serviceEndpoint
  } catch {}
  return 'https://bsky.social'
}

async function resolveHandleToDid(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`)
    if (!res.ok) return null
    return (await res.json()).did ?? null
  } catch { return null }
}

function extractCid(ref: unknown): string | null {
  if (!ref) return null
  if (typeof (ref as any)['$link'] === 'string') return (ref as any)['$link']
  if (typeof (ref as any)['/'] === 'string') return (ref as any)['/']
  const s = (ref as any).toString?.()
  if (typeof s === 'string' && s !== '[object Object]') return s
  return null
}

async function fetchProfile(did: string, knownPdsUrl?: string): Promise<{ handle: string; displayName?: string; avatar?: string } | null> {
  try {
    const pdsUrl = knownPdsUrl ?? await getPdsFromDid(did)
    const [descRes, settingsRes] = await Promise.all([
      fetch(`${pdsUrl}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`),
      fetch(`${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=com.crashthearcade.settings&rkey=self`),
    ])
    if (!descRes.ok) return null
    const handle = (await descRes.json()).handle

    let displayName: string | undefined
    let avatar: string | undefined

    if (settingsRes.ok) {
      const settings = await settingsRes.json()
      displayName = settings.value?.displayName
      if (settings.value?.avatarBlob) {
        const cid = extractCid(settings.value.avatarBlob?.ref ?? settings.value.avatarBlob)
        if (cid) avatar = `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
      }
    }

    if (!displayName || !avatar) {
      try {
        const bskyRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`)
        if (bskyRes.ok) {
          const bskyProfile = await bskyRes.json()
          if (!displayName) displayName = bskyProfile.displayName
          if (!avatar) avatar = bskyProfile.avatar
        }
      } catch {}
    }

    return { handle, displayName, avatar }
  } catch { return null }
}

function buildFeedItems(records: GameRecordView[], userHandle: string, displayName: string | undefined, avatar: string | undefined): FeedItem[] {
  const deduped = Object.values(
    records.reduce<Record<number, GameRecordView>>((acc, r) => {
      const id = r.value.game.igdbId
      if (!acc[id] || r.value.createdAt > acc[id].value.createdAt) acc[id] = r
      return acc
    }, {})
  )
  return deduped.map((r) => ({
    userHandle,
    displayName: displayName ?? null,
    avatar: avatar ?? null,
    gameTitle: r.value.game.title,
    gameCoverUrl: r.value.game.coverUrl ?? null,
    igdbId: r.value.game.igdbId,
    status: r.value.status,
    rating: r.value.rating,
    createdAt: r.value.createdAt,
  }))
}

export default function SocialPage() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [ctaFollows, setCtaFollows] = useState<FollowProfile[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchActor[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  // DID → follow record URI for quick lookup
  const followedDids = useRef<Map<string, string>>(new Map())
  // DID → { following, followUri } for search result UI
  const [followStates, setFollowStates] = useState<Record<string, { following: boolean; followUri?: string }>>({})
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({})
  const [modalGame, setModalGame] = useState<FeedItem | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<{ agent: Agent; did: string } | null>(null)

  useEffect(() => {
    restoreSession()
      .then((s) => {
        if (!s) { window.location.href = '/'; return }
        setSession(s)
        sessionRef.current = s
        s.agent.com.atproto.repo.describeRepo({ repo: s.did })
          .then((res) => setUserHandle(res.data.handle))
          .catch(() => {})
        loadSocialData(s.agent, s.did)
      })
      .catch(() => { window.location.href = '/' })
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchOpen(false); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(searchQuery)}&limit=10`)
        if (!res.ok) return
        const data = await res.json()
        const actors: SearchActor[] = (data.actors ?? []).map((a: { did: string; handle: string; displayName?: string; avatar?: string }) => ({
          did: a.did,
          handle: a.handle,
          displayName: a.displayName,
          avatar: a.avatar,
        }))

        // Set initial follow state from known follows
        const states: Record<string, { following: boolean; followUri?: string }> = {}
        for (const actor of actors) {
          const uri = followedDids.current.get(actor.did)
          states[actor.did] = { following: !!uri, followUri: uri }
        }
        setFollowStates((prev) => ({ ...prev, ...states }))
        setSearchResults(actors)
        setSearchOpen(actors.length > 0)
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  async function loadSocialData(agent: Agent, did: string) {
    setFeedLoading(true)
    try {
      // Fetch user's CTA follow records
      const followsRes = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: FOLLOW_COLLECTION,
        limit: 100,
      })

      const rawFollows = followsRes.data.records as unknown as { uri: string; value: { subject: string } }[]

      // Build followedDids map (DID → follow record URI)
      const map = new Map<string, string>()
      for (const r of rawFollows) map.set(r.value.subject, r.uri)
      followedDids.current = map

      // Fetch profile + game records for each followed DID
      const followedDidsArray = Array.from(map.entries())
      const results = await Promise.allSettled(
        followedDidsArray.map(async ([subjectDid, followUri]) => {
          const pdsUrl = await getPdsFromDid(subjectDid)
          const [profile, recordsRes] = await Promise.all([
            fetchProfile(subjectDid, pdsUrl),
            fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(subjectDid)}&collection=${encodeURIComponent(COLLECTION)}&limit=10`),
          ])
          const records: GameRecordView[] = recordsRes.ok ? ((await recordsRes.json()).records ?? []) : []
          return { subjectDid, profile, records, followUri }
        })
      )

      const follows: FollowProfile[] = []
      const items: FeedItem[] = []

      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        const { subjectDid, profile, records, followUri } = result.value
        if (!profile) continue

        follows.push({
          did: subjectDid,
          handle: profile.handle,
          displayName: profile.displayName,
          avatar: profile.avatar,
          followUri,
        })

        for (const item of buildFeedItems(records, profile.handle, profile.displayName, profile.avatar)) {
          items.push(item)
        }
      }

      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setFeedItems(items.slice(0, 20))
      setCtaFollows(follows)
    } catch (err) {
      console.error('Failed to load social data:', err)
    } finally {
      setFeedLoading(false)
    }
  }

  async function handleFollow(actor: SearchActor) {
    const s = sessionRef.current
    if (!s || followLoading[actor.did]) return
    const state = followStates[actor.did]

    setFollowLoading((prev) => ({ ...prev, [actor.did]: true }))
    try {
      if (state?.following && state.followUri) {
        const rkey = state.followUri.split('/').pop()!
        await s.agent.com.atproto.repo.deleteRecord({
          repo: s.did,
          collection: FOLLOW_COLLECTION,
          rkey,
        })
        followedDids.current.delete(actor.did)
        setFollowStates((prev) => ({ ...prev, [actor.did]: { following: false } }))
        setCtaFollows((prev) => prev.filter((f) => f.did !== actor.did))
        setFeedItems((prev) => prev.filter((f) => f.userHandle !== actor.handle))
      } else {
        const res = await s.agent.com.atproto.repo.createRecord({
          repo: s.did,
          collection: FOLLOW_COLLECTION,
          record: {
            $type: FOLLOW_COLLECTION,
            subject: actor.did,
            createdAt: new Date().toISOString(),
          },
        })
        const followUri = res.data.uri
        followedDids.current.set(actor.did, followUri)
        setFollowStates((prev) => ({ ...prev, [actor.did]: { following: true, followUri } }))

        // Fetch the new follow's profile and games to update state directly
        const pdsUrl = await getPdsFromDid(actor.did)
        const [profile, recordsRes] = await Promise.all([
          fetchProfile(actor.did, pdsUrl),
          fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(actor.did)}&collection=${encodeURIComponent(COLLECTION)}&limit=10`),
        ])
        const records: GameRecordView[] = recordsRes.ok ? ((await recordsRes.json()).records ?? []) : []

        const newFollow: FollowProfile = {
          did: actor.did,
          handle: profile?.handle ?? actor.handle,
          displayName: profile?.displayName ?? actor.displayName,
          avatar: profile?.avatar ?? actor.avatar,
          followUri,
        }
        setCtaFollows((prev) => [...prev, newFollow])

        const newItems = buildFeedItems(records, newFollow.handle, newFollow.displayName ?? undefined, newFollow.avatar ?? undefined)
        if (newItems.length > 0) {
          setFeedItems((prev) =>
            [...prev, ...newItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
          )
        }
      }
    } catch (err) {
      console.error('Failed to update follow:', err)
    } finally {
      setFollowLoading((prev) => ({ ...prev, [actor.did]: false }))
    }
  }

  async function handleUnfollow(follow: FollowProfile) {
    const s = sessionRef.current
    if (!s || followLoading[follow.did]) return
    setFollowLoading((prev) => ({ ...prev, [follow.did]: true }))
    try {
      const rkey = follow.followUri.split('/').pop()!
      await s.agent.com.atproto.repo.deleteRecord({ repo: s.did, collection: FOLLOW_COLLECTION, rkey })
      followedDids.current.delete(follow.did)
      setFollowStates((prev) => ({ ...prev, [follow.did]: { following: false } }))
      setCtaFollows((prev) => prev.filter((f) => f.did !== follow.did))
      setFeedItems((prev) => prev.filter((f) => f.userHandle !== follow.handle))
    } catch (err) {
      console.error('Failed to unfollow:', err)
    } finally {
      setFollowLoading((prev) => ({ ...prev, [follow.did]: false }))
    }
  }

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    window.location.href = '/'
  }

  return (
    <>
      <header>
        <div className="container">
          <a href="/discover" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <nav className="header-desktop-nav">
            <a href="/discover" className="nav-link">Discover</a>
            <a href="/social" className="nav-link nav-link-active">Social</a>
            <NavDropdown
              label="Collection"
              items={[
                { label: 'Games', href: '/games' },
                { label: 'Lists', href: '/lists' },
              ]}
            />
            <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
          </nav>
          <MobileMenu userHandle={userHandle} onSignOut={handleSignOut} />
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header social">
            <h1>Social</h1>
            <div ref={searchRef} className="search-wrapper">
              <input
                className="input"
                type="text"
                placeholder="Find people…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                autoComplete="off"
              />
              {searchOpen && searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((actor) => {
                    const state = followStates[actor.did]
                    const isFollowing = state?.following ?? false
                    return (
                      <div key={actor.did} className="search-result-item social-search-result">
                        <a href={`/${actor.handle}`} className="social-search-actor" onClick={() => { setSearchOpen(false); setSearchQuery('') }}>
                          {actor.avatar
                            ? <img src={actor.avatar} alt="" className="social-search-avatar" />
                            : <div className="social-search-avatar social-search-avatar-placeholder" />
                          }
                          <div>
                            {actor.displayName && <div style={{ fontSize: 14 }}>{actor.displayName}</div>}
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>@{actor.handle}</div>
                          </div>
                        </a>
                        <button
                          className={`btn btn-sm ${isFollowing ? 'btn-basic' : 'btn-ghost'}`}
                          onClick={(e) => { e.preventDefault(); handleFollow(actor) }}
                          disabled={followLoading[actor.did]}
                        >
                          {followLoading[actor.did] ? '...' : (isFollowing ? 'Following' : 'Follow')}
                        </button>

                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="social-body">
            <div className="social-left">
              {feedLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
              ) : feedItems.length === 0 ? (
                <div className="empty-state">
                  <h3>No activity yet</h3>
                  <p style={{ fontSize: '14px'}}>Find and follow people to see what they're playing</p>
                </div>
              ) : (
                <div className="social-feed">
                  {feedItems.map((item, i) => (
                    <div key={i} className="feed-item">
                      <a href={`/${item.userHandle}`} className="feed-avatar-link">
                        {item.avatar
                          ? <img src={item.avatar} alt="" className="feed-avatar" />
                          : <div className="feed-avatar feed-avatar-placeholder" />
                        }
                      </a>
                      <div className="feed-text">
                        <a href={`/${item.userHandle}`} className="feed-username">
                          {item.displayName ?? `@${item.userHandle}`}
                        </a>
                        {' '}{feedActionText(item.status)}{' '}
                        {session
                          ? <button className="feed-game-title feed-game-title-btn" onClick={() => setModalGame(item)}>{item.gameTitle}</button>
                          : <span className="feed-game-title">{item.gameTitle}</span>
                        }
                      </div>
                      {item.rating && <div style={{ marginLeft: 'auto', flexShrink: 0 }}><Stars rating={item.rating / 2} /></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="social-right">
              <div className="list-modal-section-label">
                Following{ctaFollows.length > 0 ? ` (${ctaFollows.length})` : ''}
              </div>
              {!feedLoading && ctaFollows.length === 0 ? (
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                  You're not following anyone
                </p>
              ) : (
                <div className="follows-list">
                  {ctaFollows.map((follow) => (
                    <div key={follow.did} className="follow-list-item">
                      <a href={`/${follow.handle}`} className="follow-list-item-link">
                        {follow.avatar
                          ? <img src={follow.avatar} alt="" className="follow-avatar" />
                          : <div className="follow-avatar follow-avatar-placeholder" />
                        }
                        <div className="follow-info">
                          <div className="follow-name">{follow.displayName ?? `@${follow.handle}`}</div>
                          {follow.displayName && <div className="follow-handle">@{follow.handle}</div>}
                        </div>
                      </a>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleUnfollow(follow)}
                        disabled={followLoading[follow.did]}
                        style={{ flexShrink: 0 }}
                      >
                        {followLoading[follow.did] ? '…' : 'Unfollow'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {modalGame && session && (
        <AddGameModal
          agent={session.agent}
          did={session.did}
          initialGame={{ id: modalGame.igdbId, name: modalGame.gameTitle, coverUrl: modalGame.gameCoverUrl ?? undefined }}
          onClose={() => setModalGame(null)}
          onAdded={() => setModalGame(null)}
        />
      )}
    </>
  )
}
