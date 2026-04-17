'use client'

import { useState, useEffect, useRef } from 'react'
import { Agent } from '@atproto/api'
import { IgdbGame, GameStatus, GameRecordView } from '@/types'
import { COLLECTION } from '@/lib/atproto'
import { formatIgdbGame, dateInputToISO, statusLabel } from '@/lib/igdb'
import Select from '@/components/Select'

const STATUS_OPTIONS: GameStatus[] = ['backlogged', 'started', 'wishlist', 'shelved', 'finished', 'abandoned']

interface Props {
  agent: Agent
  did: string
  onClose: () => void
  onAdded: (record: GameRecordView) => void
  initialGame?: IgdbGame & { coverUrl?: string }
}

export default function AddGameModal({ agent, did, onClose, onAdded, initialGame }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IgdbGame[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<IgdbGame | null>(initialGame ?? null)
  const [status, setStatus] = useState<GameStatus>('backlogged')
  const [platform, setPlatform] = useState('')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [finishedAt, setFinishedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/igdb/search?q=${encodeURIComponent(query)}`)
        if (res.status === 429) return // silently back off if rate limited
        const data = await res.json()
        setResults((data.games ?? []).map(formatIgdbGame))
      } catch {
        // ignore
      } finally {
        setSearching(false)
      }
    }, 500)
  }, [query])

  async function handleAdd() {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      // Store as integer × 2 (e.g. 3.5 stars → 7) since ATP lexicons don't support floats
      const ratingNum = rating ? Math.min(10, Math.max(1, Math.round(parseFloat(rating) * 2))) : undefined
      const record = {
        $type: 'com.crashthearcade.game',
        game: {
          igdbId: selected.id,
          title: selected.name,
          coverUrl: (selected as IgdbGame & { coverUrl?: string }).coverUrl,
          screenshotUrl: (selected as IgdbGame & { screenshotUrl?: string }).screenshotUrl,
          igdbUrl: selected.url,
          releaseYear: selected.first_release_date
            ? new Date(selected.first_release_date * 1000).getFullYear()
            : undefined,
          releaseDate: selected.first_release_date,
        },
        status,
        platform: platform || undefined,
        rating: isNaN(ratingNum as number) ? undefined : ratingNum,
        notes: notes || undefined,
        startedAt: dateInputToISO(startedAt),
        finishedAt: dateInputToISO(finishedAt) ?? (['finished', 'abandoned', 'shelved'].includes(status) ? new Date().toISOString() : undefined),
        createdAt: new Date().toISOString(),
      }

      const res = await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: COLLECTION,
        record,
      })

      onAdded({
        uri: res.data.uri,
        cid: res.data.cid,
        value: record as any,
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to add game:', err)
      setError(err?.message ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const igdbPlatforms = selected?.platforms?.map((p) => p.name) ?? []
  const platformOptions = [
    { value: '', label: '—' },
    ...igdbPlatforms.map((p) => ({ value: p, label: p })),
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add game</h2>

        {!selected ? (
          <div className="form-field add-modal-field">
            <div className="search-wrapper">
              <input
                className="input"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a game"
              />
              {(results.length > 0 || searching) && (
                <div className="search-results">
                  {searching && (
                    <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 14 }}>
                      Searching…
                    </div>
                  )}
                  {results.map((game) => {
                    const g = game as IgdbGame & { coverUrl?: string }
                    const year = game.first_release_date
                      ? new Date(game.first_release_date * 1000).getFullYear()
                      : null
                    return (
                      <div
                        key={game.id}
                        className="search-result-item"
                        onClick={() => { setSelected(game); setQuery(''); setResults([]) }}
                      >
                        {g.coverUrl ? (
                          <img className="search-result-cover" src={g.coverUrl} alt={game.name} />
                        ) : (
                          <div className="search-result-cover" style={{ background: 'var(--border)' }} />
                        )}
                        <div className="search-result-info">
                          <strong>{game.name}</strong>
                          <span>{year ?? 'Unknown year'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
              {(selected as IgdbGame & { coverUrl?: string }).coverUrl ? (
                <img
                  src={(selected as IgdbGame & { coverUrl?: string }).coverUrl}
                  alt={selected.name}
                  style={{ width: 48, height: 64, borderRadius: 4, objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: 48, height: 64, borderRadius: 4, background: 'var(--border)' }} />
              )}
              <div>
                <div style={{ fontWeight: 600 }}>{selected.name}</div>
                {selected.first_release_date && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {new Date(selected.first_release_date * 1000).getFullYear()}
                  </div>
                )}
              </div>
            </div>

            <div className="form-field">
              <label>Status</label>
              <Select
                variant="input"
                value={status}
                onChange={(v) => setStatus(v as GameStatus)}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))}
              />
            </div>

            <div className="form-field">
              <label>Platform</label>
              <Select
                variant="input"
                value={platform}
                onChange={setPlatform}
                options={platformOptions}
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
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="Leave blank for no rating"
              />
            </div>

            <div className="form-field">
              <label>Notes</label>
              <textarea
                className="input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-field">
                <label>Started</label>
                <input
                  className="input"
                  type="date"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Finished</label>
                <input
                  className="input"
                  type="date"
                  value={finishedAt}
                  onChange={(e) => setFinishedAt(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="error-msg">{error}</p>}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? 'Saving…' : 'Add to collection'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
