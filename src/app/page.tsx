'use client'

import { useEffect, useState, useCallback } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signIn, signOut, COLLECTION } from '@/lib/atproto'
import { GameRecordView, GameStatus, MinimapGameRecord } from '@/types/minimap'
import AddGameModal from '@/components/AddGameModal'
import GameCard from '@/components/GameCard'

const ALL_STATUSES: GameStatus[] = ['started', 'backlogged', 'wishlist', 'shelved', 'finished', 'abandoned']

export default function Home() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [handle, setHandle] = useState('')
  const [loginError, setLoginError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [games, setGames] = useState<GameRecordView[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<GameStatus | 'all'>('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    restoreSession()
      .then((s) => setSession(s))
      .finally(() => setLoading(false))
  }, [])

  const fetchGames = useCallback(async (agent: Agent, did: string) => {
    setGamesLoading(true)
    try {
      const res = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: COLLECTION,
        limit: 100,
      })
      setGames(res.data.records as unknown as GameRecordView[])
    } catch (err) {
      console.error('Failed to fetch games:', err)
    } finally {
      setGamesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) fetchGames(session.agent, session.did)
  }, [session, fetchGames])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!handle.trim()) return
    setSigningIn(true)
    setLoginError('')
    try {
      await signIn(handle.trim().replace(/^@/, ''))
    } catch {
      setLoginError('Could not sign in. Check your handle and try again.')
      setSigningIn(false)
    }
  }

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    setSession(null)
    setGames([])
  }

  function handleGameAdded(record: GameRecordView) {
    setGames((prev) => [record, ...prev])
  }

  function handleGameUpdated(uri: string, value: MinimapGameRecord) {
    setGames((prev) => prev.map((g) => (g.uri === uri ? { ...g, value } : g)))
  }

  function handleGameDeleted(uri: string) {
    setGames((prev) => prev.filter((g) => g.uri !== uri))
  }

  if (loading) return null

  if (!session) {
    return (
      <div className="login-page">
        <div>
          <div className="wordmark" style={{ fontSize: 32, marginBottom: 8 }}>minimap</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Your video game backlog, on the AT Protocol.</p>
        </div>
        <div className="login-box">
          <h2>Sign in</h2>
          <p>Enter your Bluesky or AT Protocol handle to get started.</p>
          <form onSubmit={handleSignIn}>
            <div className="input-row">
              <input
                className="input"
                type="text"
                placeholder="you.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary" type="submit" disabled={signingIn}>
                {signingIn ? '...' : 'Sign in'}
              </button>
            </div>
            {loginError && <p className="error-msg">{loginError}</p>}
          </form>
        </div>
      </div>
    )
  }

  const filteredGames =
    filterStatus === 'all' ? games : games.filter((g) => g.value.status === filterStatus)

  const countFor = (s: GameStatus) => games.filter((g) => g.value.status === s).length

  return (
    <>
      <header>
        <div className="container">
          <span className="wordmark">minimap</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{session.did}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header">
            <h1>My Games</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="view-toggle">
                <button className={`view-toggle-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view">☰</button>
                <button className={`view-toggle-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view">⊞</button>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add game</button>
            </div>
          </div>

          <div className="filter-tabs">
            <button
              className={`filter-tab${filterStatus === 'all' ? ' active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({games.length})
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

          {gamesLoading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : filteredGames.length === 0 ? (
            <div className="empty-state">
              <h3>{filterStatus === 'all' ? 'No games yet' : `No ${filterStatus} games`}</h3>
              <p>{filterStatus === 'all' ? 'Add a game to get started.' : 'Try a different filter.'}</p>
            </div>
          ) : (
            <div className={view === 'grid' ? 'game-grid' : 'game-list'}>
              {filteredGames.map((record) => (
                <GameCard
                  key={record.uri}
                  record={record}
                  agent={session.agent}
                  view={view}
                  onUpdated={handleGameUpdated}
                  onDeleted={handleGameDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <AddGameModal
          agent={session.agent}
          did={session.did}
          onClose={() => setShowAddModal(false)}
          onAdded={handleGameAdded}
        />
      )}
    </>
  )
}
