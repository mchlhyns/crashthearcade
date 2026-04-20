'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Agent } from '@atproto/api'
import { GameRecordView, GameRecord, GameStatus, PlayedStatus } from '@/types'
import { restoreSession, COLLECTION } from '@/lib/atproto'
import { statusLabel, statusClass, normalizeStatus, inferPlayedStatus, PRIMARY_STATUSES, PLAYED_STATUSES, PLAYED_STATUS_LABELS, isoToDateInput, dateInputToISO, COMMON_PLATFORMS } from '@/lib/igdb'
import AddGameModal from '@/components/AddGameModal'
import Select from '@/components/Select'

interface RelatedGame {
  id: number
  name: string
  coverUrl?: string
}

interface Props {
  games: RelatedGame[]
}

export default function RelatedGamesSection({ games }: Props) {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [records, setRecords] = useState<Record<number, GameRecordView>>({})
  const [addTarget, setAddTarget] = useState<RelatedGame | null>(null)
  const [editTarget, setEditTarget] = useState<GameRecordView | null>(null)

  useEffect(() => {
    restoreSession().then(async (s) => {
      if (!s) return
      setSession(s)
      try {
        const igdbIds = new Set(games.map(g => g.id))
        const found: Record<number, GameRecordView> = {}
        let cursor: string | undefined
        do {
          const res = await s.agent.com.atproto.repo.listRecords({ repo: s.did, collection: COLLECTION, limit: 100, cursor })
          for (const r of res.data.records as unknown as GameRecordView[]) {
            if (igdbIds.has(r.value.game.igdbId)) found[r.value.game.igdbId] = r
          }
          cursor = res.data.cursor
        } while (cursor)
        setRecords(found)
      } catch {}
    }).catch(() => {})
  }, [])

  return (
    <>
      <div className="game-detail-related-grid">
        {games.map(game => {
          const existing = records[game.id]
          return (
            <div key={game.id} className="browse-card">
              <div className="browse-card-cover-wrap">
                <a href={`/games/${game.id}`} style={{ display: 'block', lineHeight: 0 }}>
                  <img className="browse-card-cover" src={game.coverUrl ?? '/no-cover.png'} alt={game.name} />
                </a>
                {existing && (
                  <span className={`status status-${statusClass(existing.value.status, existing.value.playedStatus)} browse-card-status`}>
                    {statusLabel(existing.value.status, existing.value.playedStatus)}
                  </span>
                )}
                {session && (existing ? (
                  <button className="browse-card-action browse-card-action-edit" onClick={() => setEditTarget(existing)} title="Edit in my games">
                    <Pencil size={22} strokeWidth={2} />
                    <span>Edit</span>
                  </button>
                ) : (
                  <button className="browse-card-action" onClick={() => setAddTarget(game)} title="Add to my games">
                    <Plus size={22} strokeWidth={2} />
                    <span>Add</span>
                  </button>
                ))}
              </div>
              <div className="browse-card-title">
                <a href={`/games/${game.id}`}>{game.name}</a>
              </div>
            </div>
          )
        })}
      </div>

      {addTarget && session && (
        <AddGameModal
          agent={session.agent}
          did={session.did}
          onClose={() => setAddTarget(null)}
          onAdded={(record) => {
            setRecords(r => ({ ...r, [addTarget.id]: record }))
            setAddTarget(null)
          }}
          initialGame={{ id: addTarget.id, name: addTarget.name, coverUrl: addTarget.coverUrl } as any}
        />
      )}

      {editTarget && session && (
        <EditModal
          record={editTarget}
          agent={session.agent}
          did={session.did}
          onSaved={(updated) => {
            setRecords(r => ({ ...r, [editTarget.value.game.igdbId]: updated }))
            setEditTarget(null)
          }}
          onDeleted={() => {
            setRecords(r => {
              const next = { ...r }
              delete next[editTarget.value.game.igdbId]
              return next
            })
            setEditTarget(null)
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  )
}

function EditModal({ record, agent, did, onSaved, onDeleted, onClose }: {
  record: GameRecordView
  agent: Agent
  did: string
  onSaved: (updated: GameRecordView) => void
  onDeleted: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Partial<GameRecord>>({
    status: normalizeStatus(record.value.status) as GameStatus,
    playedStatus: inferPlayedStatus(record.value.status, record.value.playedStatus),
    platform: record.value.platform,
    rating: record.value.rating,
    notes: record.value.notes,
    startedAt: record.value.startedAt,
    finishedAt: record.value.finishedAt,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const rkey = record.uri.split('/').pop()!
    try {
      const newStatus = draft.status ?? record.value.status
      const isDone = normalizeStatus(newStatus) === 'played'
      const updated: GameRecord = {
        ...record.value,
        ...draft,
        $type: 'com.crashthearcade.game',
        playedStatus: isDone ? (draft.playedStatus ?? inferPlayedStatus(newStatus)) : undefined,
        finishedAt: isDone ? (draft.finishedAt ?? new Date().toISOString()) : draft.finishedAt,
      }
      await agent.com.atproto.repo.putRecord({ repo: did, collection: COLLECTION, rkey, record: updated as unknown as Record<string, unknown> })
      onSaved({ ...record, value: updated })
    } catch (err) {
      console.error('Failed to update:', err)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Remove "${record.value.game.title}" from your collection?`)) return
    const rkey = record.uri.split('/').pop()!
    try {
      await agent.com.atproto.repo.deleteRecord({ repo: did, collection: COLLECTION, rkey })
      onDeleted()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit — {record.value.game.title}</h2>

        <div className="form-field">
          <label>Status</label>
          <Select
            variant="input"
            value={normalizeStatus(draft.status ?? record.value.status)}
            onChange={(v) => setDraft((d) => ({ ...d, status: v as GameStatus, playedStatus: v === 'played' ? (d.playedStatus ?? 'completed') : undefined }))}
            options={PRIMARY_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
          />
        </div>
        {normalizeStatus(draft.status ?? record.value.status) === 'played' && (
          <div className="form-field">
            <label>Played status</label>
            <Select
              variant="input"
              value={draft.playedStatus ?? inferPlayedStatus(record.value.status, record.value.playedStatus) ?? 'completed'}
              onChange={(v) => setDraft((d) => ({ ...d, playedStatus: v as PlayedStatus }))}
              options={PLAYED_STATUSES.map((s) => ({ value: s, label: PLAYED_STATUS_LABELS[s] }))}
            />
          </div>
        )}

        <div className="form-field">
          <label>Platform</label>
          <Select
            variant="input"
            value={draft.platform ?? ''}
            onChange={(v) => setDraft((d) => ({ ...d, platform: v || undefined }))}
            options={[
              { value: '', label: '—' },
              ...COMMON_PLATFORMS.map((p) => ({ value: p, label: p })),
              ...(draft.platform && !COMMON_PLATFORMS.includes(draft.platform) ? [{ value: draft.platform, label: draft.platform }] : []),
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
            value={draft.rating != null ? draft.rating / 2 : ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              setDraft((d) => ({ ...d, rating: isNaN(n) ? undefined : Math.min(10, Math.max(1, Math.round(n * 2))) }))
            }}
            placeholder="Leave blank for no rating"
          />
        </div>

        <div className="form-field">
          <label>Notes</label>
          <textarea
            className="input"
            rows={3}
            value={draft.notes ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || undefined }))}
            placeholder="Optional notes"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-field">
            <label>Started</label>
            <input className="input" type="date" value={isoToDateInput(draft.startedAt)} onChange={(e) => setDraft((d) => ({ ...d, startedAt: dateInputToISO(e.target.value) }))} />
          </div>
          <div className="form-field">
            <label>Finished</label>
            <input className="input" type="date" value={isoToDateInput(draft.finishedAt)} onChange={(e) => setDraft((d) => ({ ...d, finishedAt: dateInputToISO(e.target.value) }))} />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)', marginRight: 'auto' }} onClick={remove}>Delete</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
