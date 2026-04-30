'use client'

import { useEffect, useState } from 'react'
import { restoreSession, SETTINGS_COLLECTION, FOLLOW_COLLECTION } from '@/lib/atproto'

export default function OAuthCallback() {
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      try {
        const session = await restoreSession()
        if (!session) {
          window.location.href = '/'
          return
        }

        // Check if new user and auto-follow @crashthearcade.com
        try {
          const { agent, did } = session
          const isNew = await agent.com.atproto.repo.getRecord({ repo: did, collection: SETTINGS_COLLECTION, rkey: 'self' })
            .then(() => false).catch(() => true)
          if (isNew) {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            try {
              const resolveRes = await fetch('https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=crashthearcade.com', { signal: controller.signal })
              if (resolveRes.ok) {
                const { did: ctaDid } = await resolveRes.json()
                if (typeof ctaDid === 'string' && ctaDid.startsWith('did:')) {
                  await agent.com.atproto.repo.createRecord({
                    repo: did,
                    collection: FOLLOW_COLLECTION,
                    record: { $type: FOLLOW_COLLECTION, subject: ctaDid, createdAt: new Date().toISOString() },
                  })
                }
              }
            } finally {
              clearTimeout(timeout)
            }
          }
        } catch { /* non-fatal, proceed */ }

        window.location.href = '/discover'
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError('Sign in failed. Please try again.')
      }
    }
    handleCallback()
  }, [])

  if (error) {
    return (
      <div className="login-page">
        <div className="login-box">
          <p className="error-msg">{error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => { window.location.href = '/' }}>
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <p style={{ color: 'var(--text-muted)' }}>Signing in…</p>
    </div>
  )
}
