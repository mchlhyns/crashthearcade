'use client'

import { useEffect, useRef, useState } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut, COLLECTION, FOLLOW_COLLECTION } from '@/lib/atproto'
import { GameRecordView } from '@/types'
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
  createdAt: string
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

async function fetchProfile(did: string): Promise<{ handle: string; displayName?: string; avatar?: string } | null> {
  try {
    const pdsUrl = await getPdsFromDid(did)
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`)
    if (!res.ok) return null
    const desc = await res.json()
    const handle = desc.handle
    // Fetch avatar/displayName from CTA settings if available
    const settingsRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=com.crashthearcade.settings&rkey=self`)
    let displayName: string | undefined
    let avatar: string | undefined
    if (settingsRes.ok) {
      const settings = await settingsRes.json()
      displayName = settings.value?.displayName
      if (settings.value?.avatarBlob?.ref || settings.value?.avatarBlob?.['/']) {
        const cid = settings.value.avatarBlob?.ref?.['$link'] ?? settings.value.avatarBlob?.ref?.['/'] ?? settings.value.avatarBlob?.['/']
        if (cid) avatar = `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
      }
    }
    return { handle, displayName, avatar }
  } catch { return null }
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

        // Filter to only CTA users
        const checks = await Promise.allSettled(
          actors.map(async (actor) => {
            const pdsUrl = await getPdsFromDid(actor.did)
            const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(actor.did)}&collection=${encodeURIComponent(COLLECTION)}&limit=1`)
            if (!res.ok) return null
            const data = await res.json()
            return (data.records ?? []).length > 0 ? actor : null
          })
        )
        const filtered = checks
          .filter((r) => r.status === 'fulfilled' && r.value !== null)
          .map((r) => (r as PromiseFulfilledResult<SearchActor>).value)

        // Set initial follow state from known follows
        const states: Record<string, { following: boolean; followUri?: string }> = {}
        for (const actor of filtered) {
          const uri = followedDids.current.get(actor.did)
          states[actor.did] = { following: !!uri, followUri: uri }
        }
        setFollowStates((prev) => ({ ...prev, ...states }))
        setSearchResults(filtered)
        setSearchOpen(filtered.length > 0)
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
          const [profile, pdsUrl] = await Promise.all([
            fetchProfile(subjectDid),
            getPdsFromDid(subjectDid),
          ])
          const recordsRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(subjectDid)}&collection=${encodeURIComponent(COLLECTION)}&limit=10`)
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

        const deduped = Object.values(
          records.reduce<Record<number, GameRecordView>>((acc, r) => {
            const id = r.value.game.igdbId
            if (!acc[id] || r.value.createdAt > acc[id].value.createdAt) acc[id] = r
            return acc
          }, {})
        )
        for (const record of deduped) {
          if (record.value.status !== 'started') continue
          items.push({
            userHandle: profile.handle,
            displayName: profile.displayName ?? null,
            avatar: profile.avatar ?? null,
            gameTitle: record.value.game.title,
            gameCoverUrl: record.value.game.coverUrl ?? null,
            createdAt: record.value.createdAt,
          })
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
    if (!s) return
    const state = followStates[actor.did]

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
      followedDids.current.set(actor.did, res.data.uri)
      setFollowStates((prev) => ({ ...prev, [actor.did]: { following: true, followUri: res.data.uri } }))
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
          <div className="page-header">
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
                          className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-primary'}`}
                          onClick={(e) => { e.preventDefault(); handleFollow(actor) }}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {feedLoading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : feedItems.length === 0 ? (
            <div className="empty-state">
              <h3>No activity yet</h3>
              <p>Find and follow people to see what they're playing.</p>
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
                    {' '}started playing{' '}
                    <span className="feed-game-title">{item.gameTitle}</span>
                  </div>
                  {item.gameCoverUrl && (
                    <img src={item.gameCoverUrl} alt={item.gameTitle} className="feed-game-cover" />
                  )}
                </div>
              ))}
            </div>
          )}

          {!feedLoading && ctaFollows.length > 0 && (
            <div className="social-following-section">
              <h2 className="social-section-title">Following</h2>
              <div className="follows-grid">
                {ctaFollows.map((follow) => (
                  <a key={follow.did} href={`/${follow.handle}`} className="follow-card">
                    {follow.avatar
                      ? <img src={follow.avatar} alt="" className="follow-avatar" />
                      : <div className="follow-avatar follow-avatar-placeholder" />
                    }
                    <div className="follow-info">
                      <div className="follow-name">{follow.displayName ?? `@${follow.handle}`}</div>
                      <div className="follow-handle">@{follow.handle}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
