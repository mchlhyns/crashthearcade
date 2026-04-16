'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Agent } from '@atproto/api'
import { GameRecordView, GameStatus, GameRecord } from '@/types'
import { COLLECTION } from '@/lib/atproto'
import { isoToDateInput, dateInputToISO, formatDate, statusLabel, COMMON_PLATFORMS } from '@/lib/igdb'
import Select from '@/components/Select'
import { Stars } from '@/components/Stars'

const STATUS_OPTIONS: GameStatus[] = ['backlogged', 'started', 'shelved', 'finished', 'abandoned', 'wishlist']

interface Props {
  record: GameRecordView
  agent?: Agent
  view?: 'list' | 'grid' | 'started'
  onUpdated?: (uri: string, value: GameRecord) => void
  onDeleted?: (uri: string) => void
  readonly?: boolean
}

export default function GameCard({ record, agent, view = 'list', onUpdated, onDeleted, readonly = false }: Props) {
  const { uri, value } = record
  const rkey = uri.split('/').pop()!
  const platform = value.platform?.replace(/\s*\(Microsoft Windows\)/gi, '') || undefined
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<GameRecord>>({})

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
      const updated: GameRecord = {
        ...value,
        ...draft,
        $type: 'com.crashthearcade.game',
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
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))}
          />
        </div>

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
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)',marginRight: 'auto' }} onClick={() => { setEditing(false); deleteRecord() }}>
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

  if (view === 'started') {
    const bannerSrc = value.game.screenshotUrl
    const coverEl = value.game.coverUrl ? (
      value.game.igdbUrl ? (
        <a href={value.game.igdbUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', lineHeight: 0, flexShrink: 0 }}>
          <img className="game-card-started-cover" src={value.game.coverUrl} alt={value.game.title} />
        </a>
      ) : (
        <img className="game-card-started-cover" src={value.game.coverUrl} alt={value.game.title} />
      )
    ) : (
      <img className="game-card-started-cover" src="/no-cover.png" alt={value.game.title} />
    )
    return (
      <>
        <div className="game-card-started">
          <div className="game-card-started-banner" style={bannerSrc ? { backgroundImage: `url(${bannerSrc})` } : undefined} />
          <div className="game-card-started-bottom">
            <div className="game-card-started-cover-wrap">{coverEl}</div>
            <div className="game-card-started-info">
              <div className="game-card-started-title">
                {value.game.igdbUrl ? (
                  <a href={value.game.igdbUrl} target="_blank" rel="noopener noreferrer">{value.game.title}</a>
                ) : value.game.title}
              </div>
              {(() => {
                const parts: string[] = []
                if (platform) parts.push(platform)
                if (value.startedAt) parts.push(`Started ${formatDate(value.startedAt)}`)
                return parts.length > 0 ? <div className="game-card-started-meta">{parts.join(' • ')}</div> : null
              })()}
              {value.rating && <div style={{ marginTop: 6 }}><Stars rating={value.rating / 2} monochrome={!readonly} /></div>}
            </div>
          </div>
        </div>
        {!readonly && editModal}
      </>
    )
  }

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
              <button className="browse-card-action browse-card-action-edit" onClick={startEdit}>
                <Pencil size={22} strokeWidth={2} />
                <span>Edit</span>
              </button>
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
            {platform && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 0 }}>
                {platform}
              </div>
            )}
            {value.status === 'finished' && value.rating && (
              <div><Stars rating={value.rating / 2} monochrome={!readonly} /></div>
            )}
          </div>
        </div>
        {!readonly && editModal}
      </>
    )
  }

  return (
    <div className={`game-card game-card--${value.status}`}>
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

        {(() => {
          const parts: string[] = []
          if (platform) parts.push(platform)
          if (value.status !== 'wishlist') {
            if (value.startedAt) parts.push(`Started ${formatDate(value.startedAt)}`)
            if (value.finishedAt) parts.push(`${value.status === 'shelved' ? 'Shelved' : 'Finished'} ${formatDate(value.finishedAt)}`)
          }
          return parts.length > 0 ? (
            <div className="game-card-meta">{parts.join(' • ')}</div>
          ) : null
        })()}

        {value.rating && (
          <div><Stars rating={value.rating / 2} monochrome={!readonly} /></div>
        )}

        {value.notes && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{value.notes}</p>
        )}
      </div>

      {!readonly && (
        <div style={{ flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={startEdit}>Edit</button>
        </div>
      )}

      {!readonly && editModal}
    </div>
  )
}
