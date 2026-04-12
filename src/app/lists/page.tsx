'use client'

import { useEffect, useState, useCallback } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut, COLLECTION, LIST_COLLECTION } from '@/lib/atproto'
import { GameRecordView, ListRecordView } from '@/types'
import HeaderMenu from '@/components/HeaderMenu'
import ListModal from '@/components/ListModal'
import ListShareModal from '@/components/ListShareModal'
import NavDropdown from '@/components/NavDropdown'

export default function MyListsPage() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [lists, setLists] = useState<ListRecordView[]>([])
  const [games, setGames] = useState<GameRecordView[]>([])
  const [showListModal, setShowListModal] = useState(false)
  const [editingList, setEditingList] = useState<ListRecordView | null>(null)
  const [sharingList, setSharingList] = useState<ListRecordView | null>(null)

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

  const fetchLists = useCallback(async (agent: Agent, did: string) => {
    try {
      const res = await agent.com.atproto.repo.listRecords({ repo: did, collection: LIST_COLLECTION, limit: 100 })
      setLists(res.data.records as unknown as ListRecordView[])
    } catch { /* collection may not exist yet */ }
  }, [])

  const fetchGames = useCallback(async (agent: Agent, did: string) => {
    try {
      const res = await agent.com.atproto.repo.listRecords({ repo: did, collection: COLLECTION, limit: 100 })
      setGames(res.data.records as unknown as GameRecordView[])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!session) return
    fetchLists(session.agent, session.did)
    fetchGames(session.agent, session.did)
  }, [session, fetchLists, fetchGames])

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    window.location.href = '/'
  }

  // Deduped collection for ListModal
  const deduped = Object.values(
    games.reduce<Record<number, GameRecordView>>((acc, r) => {
      const id = r.value.game.igdbId
      if (!acc[id] || r.value.createdAt > acc[id].value.createdAt) acc[id] = r
      return acc
    }, {})
  )

  const sortedLists = [...lists].sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))

  function openNewList() { setEditingList(null); setShowListModal(true) }
  function openEditList(list: ListRecordView) { setEditingList(list); setShowListModal(true) }
  function openShareList(list: ListRecordView) { setSharingList(list) }

  function handleListSaved(saved: ListRecordView) {
    setLists((prev) => {
      const exists = prev.find((l) => l.uri === saved.uri)
      return exists ? prev.map((l) => (l.uri === saved.uri ? saved : l)) : [saved, ...prev]
    })
    setShowListModal(false)
    setEditingList(null)
  }

  function handleListDeleted(uri: string) {
    setLists((prev) => prev.filter((l) => l.uri !== uri))
    setShowListModal(false)
    setEditingList(null)
  }

  if (loading) return null

  return (
    <>
      <header>
        <div className="container">
          <a href="/discover" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <a href="/discover" className="nav-link">Discover</a>
            <NavDropdown
              label="Collection"
              active={true}
              items={[
                { label: 'Games', href: '/games' },
                { label: 'Lists', href: '/lists', active: true },
              ]}
            />
            <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
          </nav>
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header">
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Lists</h1>
            <button className="btn btn-primary" onClick={openNewList}>+ New list</button>
          </div>

          {sortedLists.length === 0 ? (
            <div className="empty-state">
              <h3>No lists yet</h3>
              <p>Create a list to organize and rank your games.</p>
            </div>
          ) : (
            <div className="lists-grid">
              {sortedLists.map((list) => (
                <div key={list.uri} className="list-card" onClick={() => openEditList(list)}>
                  <div className="list-card-covers">
                    {list.value.items.slice(0, 4).map((item) => (
                      item.coverUrl
                        ? <img key={item.igdbId} src={item.coverUrl} alt={item.title} className="list-card-cover" />
                        : <div key={item.igdbId} className="list-card-cover" />
                    ))}
                    {Array.from({ length: Math.max(0, 4 - list.value.items.length) }).map((_, i) => (
                      <div key={`empty-${i}`} className="list-card-cover" />
                    ))}
                  </div>
                  <div className="list-card-info">
                    <div className="list-card-name">{list.value.name}</div>
                    <div className="list-card-count">
                      {list.value.items.length} game{list.value.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="list-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="game-card-edit-btn"
                      onClick={() => openShareList(list)}
                      disabled={list.value.items.length === 0}
                    >
                      Share to Bluesky
                    </button>
                    <button className="game-card-edit-btn" onClick={() => openEditList(list)}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showListModal && (
        <ListModal
          agent={session!.agent}
          did={session!.did}
          games={deduped}
          list={editingList ?? undefined}
          onClose={() => { setShowListModal(false); setEditingList(null) }}
          onSaved={handleListSaved}
          onDeleted={handleListDeleted}
        />
      )}

      {sharingList && (
        <ListShareModal
          list={sharingList}
          agent={session!.agent}
          did={session!.did}
          userHandle={userHandle}
          onClose={() => setSharingList(null)}
        />
      )}
    </>
  )
}
