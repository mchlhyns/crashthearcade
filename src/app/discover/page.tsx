'use client'

import { useEffect, useState, useRef } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut, COLLECTION } from '@/lib/atproto'
import { IgdbGame, GameRecordView, GameStatus, GameRecord } from '@/types'
import { formatIgdbGame, isoToDateInput, dateInputToISO, statusLabel, COMMON_PLATFORMS } from '@/lib/igdb'
import AddGameModal from '@/components/AddGameModal'
import HeaderMenu from '@/components/HeaderMenu'
import MobileMenu from '@/components/MobileMenu'
import NavDropdown from '@/components/NavDropdown'
import Select from '@/components/Select'
import { CalendarDays, Star, Plus, Pencil, Sparkles } from 'lucide-react'
import { Stars } from '@/components/Stars'

type FormattedGame = IgdbGame & { coverUrl?: string }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function BrowseCard({ game, onAdd, onEdit, existingRecord, showRating, showReleaseDate }: {
  game: FormattedGame
  onAdd?: (game: FormattedGame) => void
  onEdit?: (record: GameRecordView) => void
  existingRecord?: GameRecordView
  showRating?: boolean
  showReleaseDate?: boolean
}) {
  const releaseDateMeta = showReleaseDate && game.first_release_date
    ? new Date(game.first_release_date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="browse-card">
      <div className="browse-card-cover-wrap">
        {game.coverUrl ? (
          game.url ? (
            <a href={game.url} target="_blank" rel="noopener noreferrer">
              <img className="browse-card-cover" src={game.coverUrl} alt={game.name} />
            </a>
          ) : (
            <img className="browse-card-cover" src={game.coverUrl} alt={game.name} />
          )
        ) : (
          <img className="browse-card-cover" src="/no-cover.png" alt={game.name} />
        )}
        {existingRecord && (
          <span className={`status status-${existingRecord.value.status} browse-card-status`}>{statusLabel(existingRecord.value.status)}</span>
        )}
        {existingRecord && onEdit ? (
          <button className="browse-card-action browse-card-action-edit" onClick={() => onEdit(existingRecord)} title="Edit in my games">
            <Pencil size={22} strokeWidth={2} />
            <span>Edit</span>
          </button>
        ) : onAdd ? (
          <button className="browse-card-action" onClick={() => onAdd(game)} title="Add to my games">
            <Plus size={22} strokeWidth={2} />
            <span>Add</span>
          </button>
        ) : null}
      </div>
      <div className="browse-card-title">
        {game.url ? (
          <a href={game.url} target="_blank" rel="noopener noreferrer">{game.name}</a>
        ) : game.name}
      </div>
      {showRating && game.rating != null && (
        <div className="browse-card-meta"><Stars rating={game.rating / 20} /></div>
      )}
      {releaseDateMeta && <div className="browse-card-meta">{releaseDateMeta}</div>}
    </div>
  )
}

export default function HomePage() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<FormattedGame[]>([])
  const [recentlyReleased, setRecentlyReleased] = useState<FormattedGame[]>([])
  const [highlyRated, setHighlyRated] = useState<FormattedGame[]>([])
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(true)
  const [addTarget, setAddTarget] = useState<FormattedGame | null>(null)
  const [artworkUrls, setArtworkUrls] = useState<string[]>([])
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FormattedGame[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [myGamesMap, setMyGamesMap] = useState<Map<number, GameRecordView>>(new Map())
  const [editTarget, setEditTarget] = useState<GameRecordView | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<GameRecord>>({})
  const [editSaving, setEditSaving] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const nowPlayingBgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    restoreSession()
      .then((s) => {
        if (!s) { window.location.href = '/'; return }
        setSession(s)
        setLoading(false)
        s.agent.com.atproto.repo.describeRepo({ repo: s.did })
          .then((res) => setUserHandle(res.data.handle))
          .catch(() => {})
        s.agent.com.atproto.repo.listRecords({ repo: s.did, collection: COLLECTION, limit: 100 })
          .then((res) => {
            const map = new Map<number, GameRecordView>()
            for (const r of res.data.records as unknown as GameRecordView[]) {
              const id = r.value.game.igdbId
              if (!map.has(id) || r.value.createdAt > map.get(id)!.value.createdAt) {
                map.set(id, r)
              }
            }
            setMyGamesMap(map)
          })
          .catch(() => {})
      })
      .catch(() => { window.location.href = '/' })
  }, [])

  useEffect(() => {
    fetch('/api/igdb/trending')
      .then((r) => r.json())
      .then(({ upcoming, recentlyReleased, highlyRated, artworkUrls }) => {
        setUpcoming(shuffle((upcoming ?? []).map(formatIgdbGame)))
        setRecentlyReleased(shuffle((recentlyReleased ?? []).map(formatIgdbGame)))
        setHighlyRated(shuffle((highlyRated ?? []).map(formatIgdbGame)))
        const urls = artworkUrls ?? []
        setArtworkUrls(urls)
        if (urls.length > 0) setBgImage(urls[Math.floor(Math.random() * urls.length)])
      })
      .catch(() => {})
      .finally(() => setGamesLoading(false))
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (searchQuery.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/igdb/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults((data.games ?? []).map(formatIgdbGame))
        setSearchOpen(true)
      } catch { setSearchResults([]) }
    }, 400)
  }, [searchQuery])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      if (nowPlayingBgRef.current) {
        nowPlayingBgRef.current.style.transform = `translateY(${y * 0.3}px)`
      }
      if (headerRef.current) {
        headerRef.current.classList.toggle('scrolled', y > 4)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    window.location.href = '/'
  }

  function openEdit(record: GameRecordView) {
    setEditDraft({
      status: record.value.status,
      platform: record.value.platform,
      rating: record.value.rating,
      notes: record.value.notes,
      startedAt: record.value.startedAt,
      finishedAt: record.value.finishedAt,
    })
    setEditTarget(record)
  }

  async function saveEdit() {
    if (!editTarget || !session) return
    setEditSaving(true)
    const rkey = editTarget.uri.split('/').pop()!
    try {
      const newStatus = editDraft.status ?? editTarget.value.status
      const isDone = ['finished', 'abandoned', 'shelved'].includes(newStatus)
      const updated: GameRecord = {
        ...editTarget.value,
        ...editDraft,
        $type: 'app.crashthearcade.game',
        finishedAt: isDone
          ? (editDraft.finishedAt ?? new Date().toISOString())
          : editDraft.finishedAt,
      }
      await session.agent.com.atproto.repo.putRecord({
        repo: session.did,
        collection: COLLECTION,
        rkey,
        record: updated as unknown as Record<string, unknown>,
      })
      setMyGamesMap((prev) => {
        const next = new Map(prev)
        next.set(editTarget.value.game.igdbId, { ...editTarget, value: updated })
        return next
      })
      setEditTarget(null)
    } catch (err) {
      console.error('Failed to update record:', err)
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteEdit() {
    if (!editTarget || !session) return
    if (!confirm(`Remove "${editTarget.value.game.title}" from your collection?`)) return
    const rkey = editTarget.uri.split('/').pop()!
    try {
      await session.agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: COLLECTION,
        rkey,
      })
      setMyGamesMap((prev) => {
        const next = new Map(prev)
        next.delete(editTarget.value.game.igdbId)
        return next
      })
      setEditTarget(null)
    } catch (err) {
      console.error('Failed to delete record:', err)
    }
  }

  if (loading) return null

  return (
    <>
      <header ref={headerRef}>
        <div className="container">
          <a href="/discover" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <nav className="header-desktop-nav">
            <a href="/discover" className="nav-link nav-link-active">Discover</a>
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
        <section className="now-playing-block">
          {bgImage && (
            <div
              ref={nowPlayingBgRef}
              className="now-playing-bg"
              aria-hidden
              style={{ backgroundImage: `url(${bgImage})` }}
            />
          )}
          <div className="container">
            <div className="now-playing-content">
            <h2 className="now-playing-title">What are you playing?</h2>
            <div className="search-wrapper" ref={searchRef}>
              <input
                className="input now-playing-input"
                type="text"
                placeholder="Search for a game"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                autoComplete="off"
              />
              {searchOpen && searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((game) => {
                    const year = game.first_release_date
                      ? new Date(game.first_release_date * 1000).getFullYear()
                      : null
                    return (
                      <div
                        key={game.id}
                        className="search-result-item"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setAddTarget(game)
                          setSearchQuery('')
                          setSearchOpen(false)
                          setSearchResults([])
                        }}
                      >
                        {game.coverUrl ? (
                          <img className="search-result-cover" src={game.coverUrl} alt={game.name} />
                        ) : (
                          <div className="search-result-cover" style={{ background: 'var(--border)' }} />
                        )}
                        <div className="search-result-info">
                          <strong>{game.name}</strong>
                          <span>{year ?? 'Unknown year'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            </div>
          </div>
        </section>

        <div className="container">
          {gamesLoading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <>
              <section className="browse-section">
                <h2 className="browse-section-title"><CalendarDays size={16} color="#FFD100" />Recent releases</h2>
                {recentlyReleased.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing to show right now.</p>
                ) : (
                  <div className="browse-grid">
                    {recentlyReleased.map((game) => (
                      <BrowseCard key={game.id} game={game}
                        existingRecord={myGamesMap.get(game.id)}
                        onAdd={session ? setAddTarget : undefined}
                        onEdit={session ? openEdit : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="browse-section">
                <h2 className="browse-section-title"><Sparkles size={16} color="#FF3668" />Upcoming releases</h2>
                {upcoming.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing to show right now.</p>
                ) : (
                  <div className="browse-grid">
                    {upcoming.map((game) => (
                      <BrowseCard key={game.id} game={game}
                        existingRecord={myGamesMap.get(game.id)}
                        onAdd={session ? setAddTarget : undefined}
                        onEdit={session ? openEdit : undefined}
                        showReleaseDate
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="browse-section">
                <h2 className="browse-section-title"><Star size={16} color="#29ADFF" />Highly rated games</h2>
                {highlyRated.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing to show right now.</p>
                ) : (
                  <div className="browse-grid">
                    {highlyRated.map((game) => (
                      <BrowseCard key={game.id} game={game} showRating
                        existingRecord={myGamesMap.get(game.id)}
                        onAdd={session ? setAddTarget : undefined}
                        onEdit={session ? openEdit : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {addTarget && session && (
        <AddGameModal
          agent={session.agent}
          did={session.did}
          initialGame={addTarget}
          onClose={() => setAddTarget(null)}
          onAdded={(record: GameRecordView) => {
            setMyGamesMap((prev) => {
              const next = new Map(prev)
              next.set(record.value.game.igdbId, record)
              return next
            })
            setAddTarget(null)
          }}
        />
      )}

      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit — {editTarget.value.game.title}</h2>

            <div className="form-field">
              <label>Status</label>
              <Select
                variant="input"
                value={editDraft.status ?? editTarget.value.status}
                onChange={(v) => setEditDraft((d) => ({ ...d, status: v as GameStatus }))}
                options={(['backlogged', 'started', 'shelved', 'finished', 'abandoned', 'wishlist'] as GameStatus[]).map((s) => ({ value: s, label: statusLabel(s) }))}
              />
            </div>

            <div className="form-field">
              <label>Platform</label>
              <Select
                variant="input"
                value={editDraft.platform ?? ''}
                onChange={(v) => setEditDraft((d) => ({ ...d, platform: v || undefined }))}
                options={[
                  { value: '', label: '—' },
                  ...COMMON_PLATFORMS.map((p) => ({ value: p, label: p })),
                  ...(editDraft.platform && !COMMON_PLATFORMS.includes(editDraft.platform) ? [{ value: editDraft.platform, label: editDraft.platform }] : []),
                ]}
              />
            </div>

            <div className="form-field">
              <label>Rating (1–5)</label>
              <input
                className="input"
                type="number"
                min={0.5}
                max={5}
                step={0.5}
                value={editDraft.rating != null ? editDraft.rating / 2 : ''}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  setEditDraft((d) => ({ ...d, rating: isNaN(n) ? undefined : Math.min(10, Math.max(1, Math.round(n * 2))) }))
                }}
                placeholder="Leave blank for no rating"
              />
            </div>

            <div className="form-field">
              <label>Notes</label>
              <textarea
                className="input"
                rows={3}
                value={editDraft.notes ?? ''}
                onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value || undefined }))}
                placeholder="Optional notes"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-field">
                <label>Started</label>
                <input
                  className="input"
                  type="date"
                  value={isoToDateInput(editDraft.startedAt)}
                  onChange={(e) => setEditDraft((d) => ({ ...d, startedAt: dateInputToISO(e.target.value) }))}
                />
              </div>
              <div className="form-field">
                <label>Finished</label>
                <input
                  className="input"
                  type="date"
                  value={isoToDateInput(editDraft.finishedAt)}
                  onChange={(e) => setEditDraft((d) => ({ ...d, finishedAt: dateInputToISO(e.target.value) }))}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={deleteEdit}>
                Delete
              </button>
              <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
