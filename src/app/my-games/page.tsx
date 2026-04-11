'use client'

import { useEffect, useState, useCallback } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut, COLLECTION } from '@/lib/atproto'
import { GameRecordView, GameStatus, MinimapGameRecord } from '@/types/minimap'
import { statusLabel } from '@/lib/igdb'
import AddGameModal from '@/components/AddGameModal'
import GameCard from '@/components/GameCard'
import Select from '@/components/Select'
import HeaderMenu from '@/components/HeaderMenu'

const ALL_STATUSES: GameStatus[] = ['wishlist', 'backlogged', 'started', 'finished', 'shelved', 'abandoned']

export default function MyGamesPage() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [games, setGames] = useState<GameRecordView[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<GameStatus | 'all'>('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<'added' | 'release' | 'type'>('added')
  const [showAddModal, setShowAddModal] = useState(false)

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
    if (!session) return
    fetchGames(session.agent, session.did)
  }, [session, fetchGames])

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    window.location.href = '/'
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

  const activeSortBy = filterStatus === 'wishlist' && sortBy === 'added' ? 'release' : sortBy
  const filteredGames = [...filtered].sort((a, b) => {
    if (activeSortBy === 'added') return b.value.createdAt.localeCompare(a.value.createdAt)
    if (activeSortBy === 'release') {
      const ag = a.value.game, bg = b.value.game
      const av = ag.releaseDate ?? (ag.releaseYear != null ? ag.releaseYear * 1e7 : Infinity)
      const bv = bg.releaseDate ?? (bg.releaseYear != null ? bg.releaseYear * 1e7 : Infinity)
      return av - bv
    }
    if (activeSortBy === 'type') return ALL_STATUSES.indexOf(a.value.status) - ALL_STATUSES.indexOf(b.value.status)
    return 0
  })

  const countFor = (s: GameStatus) => deduped.filter((g) => g.value.status === s).length

  return (
    <>
      <header>
        <div className="container">
          <a href="/home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <a href="/home" className="nav-link">Home</a>
            <a href="/my-games" className="nav-link nav-link-active">My Games</a>
            <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
          </nav>
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header">
            <Select
              variant="filter"
              value={filterStatus}
              onChange={(next) => {
                setFilterStatus(next as GameStatus | 'all')
                if (next !== 'all' && sortBy === 'type') setSortBy('added')
              }}
              options={[
                { value: 'all', label: `All (${deduped.length})` },
                ...ALL_STATUSES.map((s) => ({ value: s, label: `${statusLabel(s)} (${countFor(s)})` })),
              ]}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="view-toggle">
                <button className={`view-toggle-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view">☰</button>
                <button className={`view-toggle-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view">⊞</button>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add game</button>
            </div>
          </div>

          {gamesLoading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : filteredGames.length === 0 ? (
            <div className="empty-state">
              <h3>{filterStatus === 'all' ? 'No games yet' : `No ${statusLabel(filterStatus)} games`}</h3>
              <p>{filterStatus === 'all' ? 'Add a game to get started.' : 'Try a different filter.'}</p>
            </div>
          ) : (
            <div className={view === 'grid' ? 'game-grid' : 'game-list'}>
              {filteredGames.map((record) => (
                <GameCard
                  key={record.uri}
                  record={record}
                  agent={session!.agent}
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
          agent={session!.agent}
          did={session!.did}
          onClose={() => setShowAddModal(false)}
          onAdded={handleGameAdded}
        />
      )}
    </>
  )
}
