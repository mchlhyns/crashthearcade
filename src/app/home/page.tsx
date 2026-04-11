'use client'

import { useEffect, useState, useRef } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut } from '@/lib/atproto'
import { IgdbGame, GameRecordView } from '@/types/minimap'
import { formatIgdbGame } from '@/lib/igdb'
import AddGameModal from '@/components/AddGameModal'
import HeaderMenu from '@/components/HeaderMenu'
import { Sparkles, CalendarDays, Star } from 'lucide-react'

type FormattedGame = IgdbGame & { coverUrl?: string }

function BrowseCard({ game, onAdd, showRating }: { game: FormattedGame; onAdd?: (game: FormattedGame) => void; showRating?: boolean }) {
  const meta = showRating
    ? (game.rating != null ? `${Math.round(game.rating)} / 100` : null)
    : (game.first_release_date
        ? new Date(game.first_release_date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null)

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
        {onAdd && (
          <button className="browse-card-add" onClick={() => onAdd(game)} title="Add to my games">+</button>
        )}
      </div>
      <div className="browse-card-title">{game.name}</div>
      {meta && <div className="browse-card-meta">{meta}</div>}
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
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    restoreSession()
      .then((s) => {
        if (!s) { window.location.href = '/'; return }
        setSession(s)
        setLoading(false)
        s.agent.com.atproto.repo.describeRepo({ repo: s.did })
          .then((res) => setUserHandle(res.data.handle))
          .catch(() => {})
      })
      .catch(() => { window.location.href = '/' })
  }, [])

  useEffect(() => {
    fetch('/api/igdb/trending')
      .then((r) => r.json())
      .then(({ upcoming, recentlyReleased, highlyRated, artworkUrls }) => {
        setUpcoming((upcoming ?? []).map(formatIgdbGame))
        setRecentlyReleased((recentlyReleased ?? []).map(formatIgdbGame))
        setHighlyRated((highlyRated ?? []).map(formatIgdbGame))
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

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    window.location.href = '/'
  }

  if (loading) return null

  return (
    <>
      <header>
        <div className="container">
          <a href="/home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <nav style={{ display: 'flex', gap: 4 }}>
              <a href="/home" className="nav-link nav-link-active">Home</a>
              <a href="/my-games" className="nav-link">My Games</a>
            </nav>
            <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      <main>
        <section className="now-playing-block">
          {bgImage && (
            <div
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
                placeholder="Search for a game…"
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
                <h2 className="browse-section-title"><Sparkles size={16} color="#FF3668" />Upcoming releases</h2>
                {upcoming.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing to show right now.</p>
                ) : (
                  <div className="browse-grid">
                    {upcoming.map((game) => (
                      <BrowseCard key={game.id} game={game} onAdd={session ? setAddTarget : undefined} />
                    ))}
                  </div>
                )}
              </section>

              <section className="browse-section">
                <h2 className="browse-section-title"><CalendarDays size={16} color="#FFD100" />Recently released</h2>
                {recentlyReleased.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing to show right now.</p>
                ) : (
                  <div className="browse-grid">
                    {recentlyReleased.map((game) => (
                      <BrowseCard key={game.id} game={game} onAdd={session ? setAddTarget : undefined} />
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
                      <BrowseCard key={game.id} game={game} showRating onAdd={session ? setAddTarget : undefined} />
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
          onAdded={(_record: GameRecordView) => setAddTarget(null)}
        />
      )}
    </>
  )
}
