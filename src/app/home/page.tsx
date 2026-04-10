'use client'

import { useEffect, useState } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut } from '@/lib/atproto'
import { IgdbGame, GameRecordView } from '@/types/minimap'
import { formatIgdbGame } from '@/lib/igdb'
import AddGameModal from '@/components/AddGameModal'
import HeaderMenu from '@/components/HeaderMenu'

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
          <div className="browse-card-cover browse-card-cover-placeholder">🎮</div>
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
      .then(({ upcoming, recentlyReleased, highlyRated }) => {
        setUpcoming((upcoming ?? []).map(formatIgdbGame))
        setRecentlyReleased((recentlyReleased ?? []).map(formatIgdbGame))
        setHighlyRated((highlyRated ?? []).map(formatIgdbGame))
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
              <a href="/settings" className="nav-link">Settings</a>
            </nav>
          </div>
          <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
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
                    {upcoming.map((game) => (
                      <BrowseCard key={game.id} game={game} onAdd={session ? setAddTarget : undefined} />
                    ))}
                  </div>
                )}
              </section>

              <section className="browse-section">
                <h2 className="browse-section-title">Recently Released</h2>
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
                <h2 className="browse-section-title">Highly Rated</h2>
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
