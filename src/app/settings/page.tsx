'use client'

import { useEffect, useRef, useState } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut, SETTINGS_COLLECTION } from '@/lib/atproto'
import HeaderMenu from '@/components/HeaderMenu'
import MobileMenu from '@/components/MobileMenu'
import NavDropdown from '@/components/NavDropdown'
import { GameRef, IgdbGame } from '@/types'
import { formatIgdbGame } from '@/lib/igdb'

type FormattedGame = IgdbGame & { coverUrl?: string }

interface Settings {
  displayName?: string
  profileView?: 'list' | 'grid'
  avatarBlob?: unknown
  bannerBlob?: unknown
  favouriteGame?: GameRef
}

async function resolvePds(did: string): Promise<string> {
  try {
    const url = did.startsWith('did:web:')
      ? `https://${did.slice('did:web:'.length)}/.well-known/did.json`
      : `https://plc.directory/${did}`
    const res = await fetch(url)
    if (res.ok) {
      const doc = await res.json()
      const pds = doc.service?.find((s: { id: string; serviceEndpoint: string }) => s.id === '#atproto_pds')
      if (pds?.serviceEndpoint) return pds.serviceEndpoint
    }
  } catch { /* fall back */ }
  return 'https://bsky.social'
}

function extractCid(ref: unknown): string | null {
  if (!ref) return null
  // Plain ATProto JSON: { $link: '...' }
  if (typeof (ref as any)['$link'] === 'string') return (ref as any)['$link']
  // DAG-JSON: { '/': '...' }
  if (typeof (ref as any)['/'] === 'string') return (ref as any)['/']
  // CID class instance from @atproto/api
  const s = (ref as any).toString?.()
  if (typeof s === 'string' && s !== '[object Object]') return s
  return null
}

function blobUrl(pdsUrl: string, did: string, blob: unknown): string | null {
  const cid = extractCid((blob as any)?.ref)
  if (!cid) return null
  return `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
}

export default function SettingsPage() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [pdsUrl, setPdsUrl] = useState('https://bsky.social')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [profileView] = useState<'list' | 'grid'>('grid')
  const [bskyAvatar, setBskyAvatar] = useState<string | null>(null)
  const [avatarBlob, setAvatarBlob] = useState<unknown>(null)
  const [bannerBlob, setBannerBlob] = useState<unknown>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [favouriteGame, setFavouriteGame] = useState<GameRef | null>(null)
  const [favSearchQuery, setFavSearchQuery] = useState('')
  const [favSearchResults, setFavSearchResults] = useState<FormattedGame[]>([])
  const [favSearchOpen, setFavSearchOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const favSearchRef = useRef<HTMLDivElement>(null)
  const favSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    restoreSession().then(async (s) => {
      if (!s) { window.location.href = '/'; return }
      setSession(s)
      s.agent.com.atproto.repo.describeRepo({ repo: s.did })
        .then((res) => setUserHandle(res.data.handle))
        .catch(() => {})

      const pds = await resolvePds(s.did)
      setPdsUrl(pds)

      try {
        const profileRes = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(s.did)}`
        )
        if (profileRes.ok) {
          const profile = await profileRes.json()
          setBskyAvatar(profile.avatar ?? null)
        }
      } catch { /* ignore */ }

      try {
        const res = await s.agent.com.atproto.repo.getRecord({
          repo: s.did,
          collection: SETTINGS_COLLECTION,
          rkey: 'self',
        })
        const value = res.data.value as Settings
        setDisplayName(value.displayName ?? '')
        if (value.avatarBlob) setAvatarBlob(value.avatarBlob)
        if (value.bannerBlob) setBannerBlob(value.bannerBlob)
        if (value.favouriteGame) setFavouriteGame(value.favouriteGame)
      } catch { /* no settings yet */ }

      setLoading(false)
    }).catch(() => { window.location.href = '/' })
  }, [])

  useEffect(() => {
    if (favSearchTimeout.current) clearTimeout(favSearchTimeout.current)
    if (favSearchQuery.length < 2) { setFavSearchResults([]); setFavSearchOpen(false); return }
    favSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/igdb/search?q=${encodeURIComponent(favSearchQuery)}`)
        const data = await res.json()
        setFavSearchResults((data.games ?? []).map(formatIgdbGame))
        setFavSearchOpen(true)
      } catch { setFavSearchResults([]) }
    }, 400)
  }, [favSearchQuery])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (favSearchRef.current && !favSearchRef.current.contains(e.target as Node)) {
        setFavSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function pickFile(type: 'avatar' | 'banner', file: File) {
    const preview = URL.createObjectURL(file)
    if (type === 'avatar') { setAvatarFile(file); setAvatarPreview(preview) }
    else { setBannerFile(file); setBannerPreview(preview) }
  }

  async function uploadBlob(file: File): Promise<unknown> {
    const ab = await file.arrayBuffer()
    const res = await session!.agent.uploadBlob(new Uint8Array(ab), { encoding: file.type })
    return res.data.blob
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setSaved(false)
    try {
      let newAvatarBlob = avatarBlob
      let newBannerBlob = bannerBlob
      if (avatarFile) newAvatarBlob = await uploadBlob(avatarFile)
      if (bannerFile) newBannerBlob = await uploadBlob(bannerFile)

      const record: Settings & { $type: string } = {
        $type: SETTINGS_COLLECTION,
        profileView,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(newAvatarBlob ? { avatarBlob: newAvatarBlob } : {}),
        ...(newBannerBlob ? { bannerBlob: newBannerBlob } : {}),
        ...(favouriteGame ? { favouriteGame } : {}),
      }
      await session.agent.com.atproto.repo.putRecord({
        repo: session.did,
        collection: SETTINGS_COLLECTION,
        rkey: 'self',
        record: record as unknown as Record<string, unknown>,
      })
      if (newAvatarBlob) setAvatarBlob(newAvatarBlob)
      if (newBannerBlob) setBannerBlob(newBannerBlob)
      setAvatarFile(null)
      setBannerFile(null)
      setSaved(true)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    window.location.href = '/'
  }

  if (loading) return null

  const currentAvatar = avatarPreview ?? (avatarBlob ? blobUrl(pdsUrl, session!.did, avatarBlob) : bskyAvatar)
  const currentBanner = bannerPreview ?? (bannerBlob ? blobUrl(pdsUrl, session!.did, bannerBlob) : null)

  return (
    <>
      <header>
        <div className="container">
          <a href="/discover" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <nav className="header-desktop-nav">
            <a href="/discover" className="nav-link">Discover</a>
            <NavDropdown
              label="Collection"
              items={[
                { label: 'Games', href: '/games' },
                { label: 'Lists', href: '/lists' },
              ]}
            />
            <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
          </nav>
          <MobileMenu userHandle={userHandle} onSignOut={handleSignOut} />
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1>Settings</h1>
          </div>

          <div style={{ maxWidth: 480 }}>
            <form onSubmit={handleSave}>

              {/* Avatar */}
              <div className="form-field">
                <label>Profile avatar</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {currentAvatar
                    ? <img src={currentAvatar} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                  }
                  <button type="button" className="btn btn-ghost" onClick={() => avatarInputRef.current?.click()}>
                    {currentAvatar ? 'Change avatar' : 'Upload avatar'}
                  </button>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && pickFile('avatar', e.target.files[0])}
                />
              </div>

              {/* Display name */}
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
              </div>
              
              {/* Banner */}
              <div className="form-field">
                <label>Profile banner</label>
                <div
                  className="settings-banner-preview"
                  style={currentBanner ? { backgroundImage: `url(${currentBanner})` } : undefined}
                  onClick={() => bannerInputRef.current?.click()}
                >
                  {!currentBanner && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click to upload</span>}
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && pickFile('banner', e.target.files[0])}
                />
                {currentBanner && (
                  <button type="button" className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => bannerInputRef.current?.click()}>
                    Change banner
                  </button>
                )}
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
