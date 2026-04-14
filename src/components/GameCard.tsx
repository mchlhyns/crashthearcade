'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Agent } from '@atproto/api'
import { GameRecordView, GameStatus, GameRecord } from '@/types'
import { COLLECTION } from '@/lib/atproto'
import { isoToDateInput, dateInputToISO, formatDate, statusLabel, COMMON_PLATFORMS } from '@/lib/igdb'
import Select from '@/components/Select'

const STATUS_OPTIONS: GameStatus[] = ['backlogged', 'started', 'shelved', 'finished', 'abandoned', 'wishlist']

const starPath = "M11.1001 2.44358C11.4645 1.69178 12.5355 1.69178 12.8999 2.44358L15.4347 7.67365C15.5805 7.97434 15.8668 8.18237 16.1978 8.2281L21.9567 9.02365C22.7842 9.13796 23.1151 10.1564 22.5128 10.7352L18.3216 14.7634C18.0807 14.9949 17.9713 15.3314 18.0301 15.6603L19.053 21.3821C19.2 22.2045 18.3335 22.8339 17.5969 22.4398L12.4716 19.6982C12.177 19.5406 11.823 19.5406 11.5283 19.6982L6.40231 22.4398C5.66562 22.8339 4.7992 22.2044 4.94631 21.382L5.96982 15.6604C6.02866 15.3315 5.91931 14.9949 5.67838 14.7633L1.4872 10.7352C0.884912 10.1564 1.2158 9.13796 2.0433 9.02365L7.80222 8.2281C8.13323 8.18237 8.41952 7.97434 8.56525 7.67365L11.1001 2.44358Z"

const STAR_YELLOW = '#FFD100'

function StarFull({ size, monochrome }: { size: number; monochrome?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={starPath} fill={monochrome ? 'var(--text-muted)' : STAR_YELLOW} />
    </svg>
  )
}

function StarEmpty({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={starPath} fill="currentColor" fillOpacity={0.15} />
    </svg>
  )
}

function StarHalf({ size, monochrome }: { size: number; monochrome?: boolean }) {
  const filledColor = monochrome ? 'var(--text-muted)' : STAR_YELLOW
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12.001 19.5801C11.8388 19.58 11.6767 19.6195 11.5293 19.6982L6.40332 22.4395C5.66663 22.8335 4.80015 22.2042 4.94727 21.3818L5.9707 15.6602C6.02943 15.3313 5.91955 14.9952 5.67871 14.7637L1.48828 10.7354C0.88599 10.1565 1.21644 9.13775 2.04395 9.02344L7.80273 8.22852C8.13362 8.18281 8.41965 7.97435 8.56543 7.67383L11.1006 2.44336C11.2829 2.06741 11.6421 1.87975 12.001 1.87988V19.5801Z" fill={filledColor} />
      <path d="M11.9993 19.5801C12.1615 19.58 12.3236 19.6195 12.471 19.6982L17.597 22.4395C18.3337 22.8335 19.2001 22.2042 19.053 21.3818L18.0296 15.6602C17.9709 15.3313 18.0807 14.9952 18.3216 14.7637L22.512 10.7354C23.1143 10.1565 22.7838 9.13775 21.9563 9.02344L16.1975 8.22852C15.8667 8.18281 15.5806 7.97435 15.4349 7.67383L12.8997 2.44336C12.7174 2.06741 12.3582 1.87975 11.9993 1.87988V19.5801Z" fill="currentColor" fillOpacity={0.15} />
    </svg>
  )
}

function Stars({ rating, monochrome }: { rating: number; monochrome?: boolean }) {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  const size = 14
  return (
    <span style={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
      {Array.from({ length: full }).map((_, i) => <StarFull key={`f${i}`} size={size} monochrome={monochrome} />)}
      {half && <StarHalf size={size} monochrome={monochrome} />}
      {Array.from({ length: empty }).map((_, i) => <StarEmpty key={`e${i}`} size={size} />)}
    </span>
  )
}

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
