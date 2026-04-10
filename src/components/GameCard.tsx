'use client'

import { useState } from 'react'
import { Star, StarHalf } from 'lucide-react'
import { Agent } from '@atproto/api'
import { GameRecordView, GameStatus, MinimapGameRecord } from '@/types/minimap'
import { COLLECTION } from '@/lib/atproto'
import { isoToDateInput, dateInputToISO, formatDate } from '@/lib/igdb'
import Select from '@/components/Select'

const STATUS_OPTIONS: GameStatus[] = ['backlogged', 'started', 'shelved', 'finished', 'abandoned', 'wishlist']

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  const color = 'var(--text-muted)'
  const size = 14
  const sw = 1.5
  return (
    <span style={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
      {Array.from({ length: full }).map((_, i) => <Star key={`f${i}`} size={size} fill={color} stroke={color} strokeWidth={sw} />)}
      {half && <StarHalf size={size} fill={color} stroke={color} strokeWidth={sw} />}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} size={size} fill="none" stroke={color} strokeWidth={sw} />)}
    </span>
  )
}

interface Props {
  record: GameRecordView
  agent?: Agent
  view?: 'list' | 'grid'
  onUpdated?: (uri: string, value: MinimapGameRecord) => void
  onDeleted?: (uri: string) => void
  readonly?: boolean
}

export default function GameCard({ record, agent, view = 'list', onUpdated, onDeleted, readonly = false }: Props) {
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
    if (!agent) return
    setSaving(true)
    try {
      const newStatus = draft.status ?? value.status
      const isDone = ['finished', 'abandoned', 'shelved'].includes(newStatus)
      const updated: MinimapGameRecord = {
        ...value,
        ...draft,
        $type: 'app.crashthearcade.game',
        finishedAt: isDone
          ? (draft.finishedAt ?? new Date().toISOString())
          : draft.finishedAt,
      }
      await agent.com.atproto.repo.putRecord({
        repo: agent.assertDid,
        collection: COLLECTION,
        rkey,
        record: updated as unknown as Record<string, unknown>,
      })
      onUpdated?.(uri, updated)
      setEditing(false)
    } catch (err) {
      console.error('Failed to update record:', err)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord() {
    if (!agent) return
    if (!confirm(`Remove "${value.game.title}" from your collection?`)) return
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: agent.assertDid,
        collection: COLLECTION,
        rkey,
      })
      onDeleted?.(uri)
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
          <Select
            variant="input"
            value={draft.status ?? value.status}
            onChange={(v) => setDraft((d) => ({ ...d, status: v as GameStatus }))}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
          />
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
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => { setEditing(false); deleteRecord() }}>
            Delete
          </button>
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
        <div className="game-card-grid">
          <div className="game-card-grid-cover-wrap">
            {value.game.coverUrl ? (
              value.game.igdbUrl ? (
                <a href={value.game.igdbUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                  <img className="game-card-grid-cover" src={value.game.coverUrl} alt={value.game.title} />
                </a>
              ) : (
                <img className="game-card-grid-cover" src={value.game.coverUrl} alt={value.game.title} />
              )
            ) : (
              <img className="game-card-grid-cover" src="/no-cover.png" alt={value.game.title} />
            )}
            {!readonly && (
              <button className="game-card-grid-edit" onClick={startEdit} title="Edit">✎</button>
            )}
          </div>
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
        {!readonly && editModal}
      </>
    )
  }

  return (
    <div className="game-card">
      {value.game.coverUrl ? (
        <img className="game-card-cover" src={value.game.coverUrl} alt={value.game.title} />
      ) : (
        <img className="game-card-cover" src="/no-cover.png" alt={value.game.title} />
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
          {value.rating && <Stars rating={value.rating / 2} />}
          {value.status === 'wishlist' ? (
            (value.game.releaseDate || value.game.releaseYear) && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Available {value.game.releaseDate
                  ? new Date(value.game.releaseDate * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : value.game.releaseYear}
              </span>
            )
          ) : (
            value.startedAt && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Started {formatDate(value.startedAt)}
                {value.finishedAt && ` · ${value.status === 'shelved' ? 'Shelved' : 'Finished'} ${formatDate(value.finishedAt)}`}
              </span>
            )
          )}
        </div>

        {value.notes && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{value.notes}</p>
        )}
      </div>

      {!readonly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={startEdit}>Edit</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={deleteRecord}>
            Remove
          </button>
        </div>
      )}

      {!readonly && editModal}
    </div>
  )
}
