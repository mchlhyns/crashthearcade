'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOAuthClient } from '@/lib/atproto'

export default function OAuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      try {
        const client = await getOAuthClient()
        await client.initCallback()
        // Session is now stored in IndexedDB; redirect to home
        router.replace('/home')
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError('Sign in failed. Please try again.')
      }
    }
    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="login-page">
        <div className="login-box">
          <p className="error-msg">{error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => router.replace('/')}>
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
