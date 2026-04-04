'use client'

import { useState } from 'react'
import { Agent } from '@atproto/api'
import { GameRecordView, GameStatus, MinimapGameRecord } from '@/types/minimap'
import { COLLECTION } from '@/lib/atproto'
import { isoToDateInput, dateInputToISO, formatDate } from '@/lib/igdb'

const STATUS_OPTIONS: GameStatus[] = ['backlogged', 'started', 'shelved', 'finished', 'abandoned', 'wishlist']

function renderStars(rating: number): string {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
}

interface Props {
  record: GameRecordView
  agent: Agent
  view?: 'list' | 'grid'
  onUpdated: (uri: string, value: MinimapGameRecord) => void
  onDeleted: (uri: string) => void
}

export default function GameCard({ record, agent, view = 'list', onUpdated, onDeleted }: Props) {
  const { uri, value } = record
  const rkey = uri.split('/').pop()!
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<MinimapGameRecord>>({})

  function startEdit() {
    setDraft({
      status: value.status,
      platform: value.platform,
      rating: value.rating,
      notes: value.notes,
      startedAt: value.startedAt,
      finishedAt: value.finishedAt,
    })
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const updated: MinimapGameRecord = {
        ...value,
        ...draft,
        $type: 'app.minimap.game',
      }
      await agent.com.atproto.repo.putRecord({
        repo: agent.assertDid,
        collection: COLLECTION,
        rkey,
        record: updated as unknown as Record<string, unknown>,
      })
      onUpdated(uri, updated)
      setEditing(false)
    } catch (err) {
      console.error('Failed to update record:', err)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord() {
    if (!confirm(`Remove "${value.game.title}" from your collection?`)) return
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: agent.assertDid,
        collection: COLLECTION,
        rkey,
      })
      onDeleted(uri)
    } catch (err) {
      console.error('Failed to delete record:', err)
    }
  }

  const editModal = editing ? (
    <div className="modal-overlay" onClick={() => setEditing(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit — {value.game.title}</h2>

        <div className="form-field">
          <label>Status</label>
          <select
            className="input"
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as GameStatus }))}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Platform</label>
          <input
            className="input"
            value={draft.platform ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, platform: e.target.value || undefined }))}
            placeholder="e.g. PS5, PC, Switch"
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
            <input
              className="input"
              type="date"
              value={isoToDateInput(draft.startedAt)}
              onChange={(e) => setDraft((d) => ({ ...d, startedAt: dateInputToISO(e.target.value) }))}
            />
          </div>
          <div className="form-field">
            <label>Finished</label>
            <input
              className="input"
              type="date"
              value={isoToDateInput(draft.finishedAt)}
              onChange={(e) => setDraft((d) => ({ ...d, finishedAt: dateInputToISO(e.target.value) }))}
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (view === 'grid') {
    return (
      <>
        <div className="game-card-grid" onClick={startEdit}>
          {value.game.coverUrl ? (
            <img className="game-card-grid-cover" src={value.game.coverUrl} alt={value.game.title} />
          ) : (
            <div className="game-card-grid-placeholder">🎮</div>
          )}
          <div className="game-card-grid-info">
            <div className="game-card-grid-title">
            {value.game.igdbUrl ? (
              <a href={value.game.igdbUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                {value.game.title}
              </a>
            ) : value.game.title}
          </div>
            <span className={`status status-${value.status}`}>{value.status}</span>
          </div>
        </div>
        {editModal}
      </>
    )
  }

  return (
    <div className="game-card">
      {value.game.coverUrl ? (
        <img className="game-card-cover" src={value.game.coverUrl} alt={value.game.title} />
      ) : (
        <div className="game-card-cover-placeholder">🎮</div>
      )}

      <div className="game-card-body">
        <div className="game-card-title">
          {value.game.igdbUrl ? (
            <a href={value.game.igdbUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {value.game.title}
            </a>
          ) : value.game.title}
        </div>
        {value.platform && <div className="game-card-meta">{value.platform}</div>}

        <div className="game-card-footer">
          <span className={`status status-${value.status}`}>{value.status}</span>
          {value.rating && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{renderStars(value.rating / 2)}</span>}
          {value.startedAt && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Started {formatDate(value.startedAt)}
              {value.finishedAt && ` · Finished ${formatDate(value.finishedAt)}`}
            </span>
          )}
        </div>

        {value.notes && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{value.notes}</p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={startEdit}>Edit</button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={deleteRecord}>
          Remove
        </button>
      </div>

      {editModal}
    </div>
  )
}
