'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Agent } from '@atproto/api'
import { IgdbGame, GameStatus, GameRecord, GameRecordView } from '@/types'
import { restoreSession, COLLECTION } from '@/lib/atproto'
import { statusLabel, isoToDateInput, dateInputToISO, COMMON_PLATFORMS } from '@/lib/igdb'
import AddGameModal from '@/components/AddGameModal'
import Select from '@/components/Select'

type GameProp = Pick<IgdbGame, 'id' | 'name' | 'url' | 'first_release_date' | 'platforms'> & {
  coverUrl?: string
  screenshotUrl?: string
}

interface Props {
  game: GameProp
}

export default function AddGameButton({ game }: Props) {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [existingRecord, setExistingRecord] = useState<GameRecordView | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [coverWrap, setCoverWrap] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setCoverWrap(document.getElementById('game-cover-wrap'))
  }, [])

  useEffect(() => {
    restoreSession()
      .then(async (s) => {
        setSession(s)
        setSessionReady(true)
        if (!s) return

        try {
          let cursor: string | undefined
          scan: do {
            const res = await s.agent.com.atproto.repo.listRecords({
              repo: s.did,
              collection: COLLECTION,
              limit: 100,
              cursor,
            })
            for (const r of res.data.records as unknown as GameRecordView[]) {
              if (r.value.game.igdbId === game.id) {
                setExistingRecord(r)
                break scan
              }
            }
            cursor = res.data.cursor
          } while (cursor)
        } catch {}
      })
      .catch(() => setSessionReady(true))
  }, [game.id])

  if (!sessionReady) return <div style={{ height: 36, marginBottom: 20 }} />

  if (!session) {
    return (
      <a href="/" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }}>
        Sign in to add
      </a>
    )
  }

  if (existingRecord) {
    return (
      <>
        {coverWrap && createPortal(
          <span className={`status status-${existingRecord.value.status} browse-card-status`}>
            {statusLabel(existingRecord.value.status)}
          </span>,
          coverWrap
        )}
        <div style={{ marginBottom: 20 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setShowEditModal(true)}
          >
            Edit in collection
          </button>
        </div>
        {showEditModal && session && (
          <EditModal
            record={existingRecord}
            agent={session.agent}
            did={session.did}
            onSaved={(updated) => { setExistingRecord(updated); setShowEditModal(false) }}
            onDeleted={() => { setExistingRecord(null); setShowEditModal(false) }}
            onClose={() => setShowEditModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }}
        onClick={() => setShowAddModal(true)}
      >
        + Add to collection
      </button>
      {showAddModal && (
        <AddGameModal
          agent={session.agent}
          did={session.did}
          onClose={() => setShowAddModal(false)}
          onAdded={(record) => { setExistingRecord(record); setShowAddModal(false) }}
          initialGame={game as IgdbGame & { coverUrl?: string }}
        />
      )}
    </>
  )
}

const STATUS_OPTIONS: GameStatus[] = ['backlogged', 'started', 'wishlist', 'shelved', 'finished', 'abandoned']

function EditModal({ record, agent, did, onSaved, onDeleted, onClose }: {
  record: GameRecordView
  agent: Agent
  did: string
  onSaved: (updated: GameRecordView) => void
  onDeleted: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Partial<GameRecord>>({
    status: record.value.status,
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
      const isDone = ['finished', 'abandoned', 'shelved'].includes(newStatus)
      const updated: GameRecord = {
        ...record.value,
        ...draft,
        $type: 'com.crashthearcade.game',
        finishedAt: isDone ? (draft.finishedAt ?? new Date().toISOString()) : draft.finishedAt,
      }
      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: COLLECTION,
        rkey,
        record: updated as unknown as Record<string, unknown>,
      })
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
            value={draft.status ?? record.value.status}
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
              ...(draft.platform && !COMMON_PLATFORMS.includes(draft.platform)
                ? [{ value: draft.platform, label: draft.platform }]
                : []),
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
          <button
            className="btn btn-ghost"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', marginRight: 'auto' }}
            onClick={remove}
          >
            Delete
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
