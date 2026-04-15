import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'CRASH THE ARCADE profile'

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const clean = handle.replace(/^@/, '')

  const [spaceGroteskBold, spaceMonoBold, logoData] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf')),
    readFile(join(process.cwd(), 'public/fonts/SpaceMono/SpaceMono-Bold.ttf')),
    readFile(join(process.cwd(), 'public/cta-wide-logo.png'), 'base64'),
  ])

  const logoSrc = `data:image/png;base64,${logoData}`

  let displayName: string | null = null
  let avatarUrl: string | null = null
  let bannerUrl: string | null = null

  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(clean)}`,
      { cache: 'no-store' }
    )
    if (res.ok) {
      const profile = await res.json()
      displayName = profile.displayName ?? null
      avatarUrl = profile.avatar ?? null
      bannerUrl = profile.banner ?? null
    }
  } catch { /* use defaults */ }

  const name = displayName ?? `@${clean}`
  const subtitle = displayName ? `@${clean}` : null

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#08121D',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '"Space Grotesk"',
        }}
      >
        {/* Banner background */}
        {bannerUrl && (
          <img
            src={bannerUrl}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Dark overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: bannerUrl
              ? 'linear-gradient(to bottom, rgba(8,18,29,0.55) 0%, rgba(8,18,29,0.85) 55%, rgba(8,18,29,0.97) 100%)'
              : '#08121D',
            display: 'flex',
          }}
        />

        {/* Logo — top left */}
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 64,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img src={logoSrc} style={{ height: 28 }} />
        </div>

        {/* Profile block — bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 64,
            left: 64,
            right: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 40,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              style={{
                width: 128,
                height: 128,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid rgba(255,255,255,0.12)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 128,
                height: 128,
                borderRadius: '50%',
                background: '#1F2731',
                flexShrink: 0,
                display: 'flex',
              }}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {name}
            </div>
            {subtitle && (
              <div
                style={{
                  fontSize: 28,
                  color: '#8D9197',
                  fontFamily: '"Space Mono"',
                  letterSpacing: '0.01em',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Accent bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: '#10D275',
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Space Grotesk', data: spaceGroteskBold, weight: 700 },
        { name: 'Space Mono', data: spaceMonoBold, weight: 700 },
      ],
    }
  )
}
