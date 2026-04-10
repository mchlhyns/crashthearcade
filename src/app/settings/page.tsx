'use client'

import { useEffect, useState } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, SETTINGS_COLLECTION } from '@/lib/atproto'

interface Settings {
  displayName?: string
  profileView?: 'list' | 'grid'
}

export default function SettingsPage() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [profileView, setProfileView] = useState<'list' | 'grid'>('list')
  const [avatar, setAvatar] = useState<string | null>(null)

  useEffect(() => {
    restoreSession().then(async (s) => {
      if (!s) { window.location.href = '/'; return }
      setSession(s)

      // Fetch Bluesky profile for avatar and display name fallback
      let bskyDisplayName = ''
      try {
        const profileRes = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(s.did)}`
        )
        if (profileRes.ok) {
          const profile = await profileRes.json()
          bskyDisplayName = profile.displayName ?? ''
          setAvatar(profile.avatar ?? null)
        }
      } catch { /* ignore */ }

      // Load saved settings, falling back to Bluesky values
      try {
        const res = await s.agent.com.atproto.repo.getRecord({
          repo: s.did,
          collection: SETTINGS_COLLECTION,
          rkey: 'self',
        })
        const value = res.data.value as Settings
        setDisplayName(value.displayName ?? bskyDisplayName)
        setProfileView(value.profileView ?? 'list')
      } catch {
        setDisplayName(bskyDisplayName)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setSaved(false)
    try {
      const record: Settings & { $type: string } = {
        $type: SETTINGS_COLLECTION,
        profileView,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      }
      await session.agent.com.atproto.repo.putRecord({
        repo: session.did,
        collection: SETTINGS_COLLECTION,
        rkey: 'self',
        record: record as unknown as Record<string, unknown>,
      })
      setSaved(true)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <>
      <header>
        <div className="container">
          <a href="/home" style={{ lineHeight: 0 }}><img src="/logo.png" alt="CRASH THE ARCADE" style={{ height: 18 }} /></a>
          <a href="/home" className="nav-link">← Back</a>
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1>Settings</h1>
          </div>

          <div style={{ maxWidth: 440 }}>
            {avatar && (
              <div style={{ marginBottom: 24 }}>
                <img src={avatar} alt="" style={{ width: 64, height: 64, borderRadius: '50%' }} />
              </div>
            )}
            <form onSubmit={handleSave}>
              <div className="form-field">
                <label>Display name</label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={64}
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Shown on your public profile instead of your handle.
                </p>
              </div>

              <div className="form-field">
                <label>Default profile view</label>
                <div className="view-toggle" style={{ width: 'fit-content' }}>
                  <button
                    type="button"
                    className={`view-toggle-btn${profileView === 'list' ? ' active' : ''}`}
                    onClick={() => setProfileView('list')}
                  >
                    ☰ List
                  </button>
                  <button
                    type="button"
                    className={`view-toggle-btn${profileView === 'grid' ? ' active' : ''}`}
                    onClick={() => setProfileView('grid')}
                  >
                    ⊞ Grid
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {saved && <span style={{ fontSize: 13, color: 'var(--accent)' }}>Saved</span>}
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  )
}
