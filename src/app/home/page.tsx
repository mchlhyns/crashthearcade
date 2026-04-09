'use client'

import { useEffect, useState } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut } from '@/lib/atproto'
import { normalizeCoverUrl } from '@/lib/igdb'

interface TrendingGame {
  id: number
  name: string
  url?: string
  cover?: { url: string }
  first_release_date?: number
  rating?: number
  hypes?: number
  platforms?: { name: string }[]
}

function BrowseCard({ game }: { game: TrendingGame }) {
  const coverUrl = game.cover ? normalizeCoverUrl(game.cover.url) : null
  const releaseDate = game.first_release_date
    ? new Date(game.first_release_date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const inner = (
    <>
      {coverUrl ? (
        <img className="browse-card-cover" src={coverUrl} alt={game.name} />
      ) : (
        <div className="browse-card-cover browse-card-cover-placeholder">🎮</div>
      )}
      <div className="browse-card-title">{game.name}</div>
      {releaseDate && <div className="browse-card-meta">{releaseDate}</div>}
    </>
  )

  return game.url ? (
    <a className="browse-card" href={game.url} target="_blank" rel="noopener noreferrer">{inner}</a>
  ) : (
    <div className="browse-card">{inner}</div>
  )
}

export default function HomePage() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<TrendingGame[]>([])
  const [highlyRated, setHighlyRated] = useState<TrendingGame[]>([])
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(true)

  useEffect(() => {
    restoreSession().then((s) => {
      if (!s) { window.location.href = '/'; return }
      setSession(s)
      setLoading(false)
      s.agent.com.atproto.repo.describeRepo({ repo: s.did })
        .then((res) => setUserHandle(res.data.handle))
        .catch(() => {})
    })
  }, [])

  useEffect(() => {
    fetch('/api/igdb/trending')
      .then((r) => r.json())
      .then(({ upcoming, highlyRated }) => {
        setUpcoming(upcoming ?? [])
        setHighlyRated(highlyRated ?? [])
      })
      .catch(() => {})
      .finally(() => setGamesLoading(false))
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="/home" style={{ lineHeight: 0 }}><img src="/logo.png" alt="CRASH THE ARCADE" style={{ height: 18 }} /></a>
            <nav style={{ display: 'flex', gap: 4 }}>
              <a href="/home" className="nav-link nav-link-active">Home</a>
              <a href="/my-games" className="nav-link">My Games</a>
            </nav>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {userHandle && (
              <a href={`/${userHandle}`} style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
                @{userHandle}
              </a>
            )}
            <a href="/settings" className="btn btn-ghost btn-sm">Settings</a>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </header>

      <main>
        <div className="container">
          {gamesLoading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <>
              <section className="browse-section">
                <h2 className="browse-section-title">Upcoming</h2>
                {upcoming.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing to show right now.</p>
                ) : (
                  <div className="browse-grid">
                    {upcoming.map((game) => <BrowseCard key={game.id} game={game} />)}
                  </div>
                )}
              </section>

              <section className="browse-section">
                <h2 className="browse-section-title">Highly Rated</h2>
                {highlyRated.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing to show right now.</p>
                ) : (
                  <div className="browse-grid">
                    {highlyRated.map((game) => <BrowseCard key={game.id} game={game} />)}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}
