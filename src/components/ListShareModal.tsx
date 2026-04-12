'use client'

import { useEffect, useRef, useState } from 'react'
import { Agent } from '@atproto/api'
import { ListRecordView, ListRecord } from '@/types'

interface Props {
  list: ListRecordView
  agent: Agent
  did: string
  userHandle: string | null
  onClose: () => void
}

const COLS = 5
const ROWS = 4
const GAP = 16
const HEADER_H = 72
const W = 1200
const CELL_W = (W - (COLS - 1) * GAP) / COLS          // 288
const CELL_H = Math.round(CELL_W * (4 / 3))            // 384 — 3:4 cover ratio
const H = HEADER_H + ROWS * CELL_H + (ROWS - 1) * GAP // 2056

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const timeout = setTimeout(() => { img.src = ''; resolve(null) }, 10000)
    img.onload = () => { clearTimeout(timeout); resolve(img) }
    img.onerror = () => { clearTimeout(timeout); resolve(null) }
    img.src = src
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!img) {
    ctx.fillStyle = '#111c2a'
    ctx.fillRect(x, y, w, h)
    return
  }
  // Center crop to fill the cell
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const scale = Math.max(w / iw, h / ih)
  const srcW = w / scale
  const srcH = h / scale
  const srcX = (iw - srcW) / 2
  const srcY = (ih - srcH) / 2
  ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h)
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

async function generateImage(list: ListRecord): Promise<Blob> {
  await document.fonts.ready

  const items = list.items.slice(0, COLS * ROWS)

  // Load cover images (via proxy) and site logo in parallel
  const [coverImages, logoImg] = await Promise.all([
    Promise.all(
      items.map((item) =>
        item.coverUrl
          ? loadImage(`/api/proxy-image?url=${encodeURIComponent(item.coverUrl)}`)
          : Promise.resolve(null)
      )
    ),
    loadImage('/logo.png'),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── Header ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#08121D'
  ctx.fillRect(0, 0, W, HEADER_H)

  // List name — top left
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 28px "Space Grotesk"'
  const maxNameW = W * 0.6
  ctx.fillText(truncate(ctx, list.name, maxNameW), 24, (HEADER_H + 28) / 2)

  // Logo — top right
  if (logoImg) {
    const logoH = 20
    const logoW = logoImg.naturalWidth * (logoH / logoImg.naturalHeight)
    const logoX = W - 24 - logoW
    const logoY = (HEADER_H - logoH) / 2
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH)
  }

  // Header bottom border
  ctx.fillStyle = '#1F2731'
  ctx.fillRect(0, HEADER_H - 1, W, 1)

  // ── Cover grid ──────────────────────────────────────────────────────────
  for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = col * (CELL_W + GAP)
    const y = HEADER_H + row * (CELL_H + GAP)
    const item = items[i]

    if (!item) {
      ctx.fillStyle = '#0d1824'
      ctx.fillRect(x, y, CELL_W, CELL_H)
      continue
    }

    drawCover(ctx, coverImages[i] ?? null, x, y, CELL_W, CELL_H)

    // Gradient overlay for rank badge readability
    const grad = ctx.createLinearGradient(x, y + CELL_H - 44, x, y + CELL_H)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.82)')
    ctx.fillStyle = grad
    ctx.fillRect(x, y + CELL_H - 44, CELL_W, 44)

    // Rank badge
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = '700 13px "Space Mono"'
    ctx.fillText(`#${item.position}`, x + 9, y + CELL_H - 11)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.93
    )
  })
}

export default function ListShareModal({ list, agent, did, userHandle, onClose }: Props) {
  const profileUrl = userHandle ? `${window.location.origin}/${userHandle}` : window.location.origin
  const count = Math.min(list.value.items.length, COLS * ROWS)
  const defaultPostText = `Check out my top ${count} on CRASH THE ARCADE. ${profileUrl}`

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [postText, setPostText] = useState(defaultPostText)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [error, setError] = useState('')
  const blobRef = useRef<Blob | null>(null)
  const prevUrlRef = useRef<string | null>(null)

  useEffect(() => {
    generateImage(list.value)
      .then((blob) => {
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        prevUrlRef.current = url
        setPreviewUrl(url)
      })
      .catch((err) => {
        console.error('Failed to generate image:', err)
        setError('Failed to generate preview image.')
      })
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleShare() {
    if (!blobRef.current) return
    setSharing(true)
    setError('')
    try {
      const arrayBuffer = await blobRef.current.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      const uploadRes = await agent.com.atproto.repo.uploadBlob(uint8, { encoding: 'image/jpeg' } as any)
      const blobRef2 = uploadRes.data.blob

      const count = Math.min(list.value.items.length, COLS * ROWS)
      const defaultText = `My top ${count} in "${list.value.name}" on Crash the Arcade`
      const text = postText.trim() || defaultText

      await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text,
          embed: {
            $type: 'app.bsky.embed.images',
            images: [{ image: blobRef2, alt: `Top ${count} games in "${list.value.name}"` }],
          },
          createdAt: new Date().toISOString(),
        },
      })
      setShared(true)
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (msg.includes('scope') || msg.includes('unauthorized') || msg.includes('403')) {
        setError('Bluesky sharing requires updated permissions. Please sign out and sign back in.')
      } else {
        setError(msg || 'Failed to post. Please try again.')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Share to Bluesky</h2>

        <div className="share-modal-body">
          <div className="share-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Share preview" />
            ) : (
              <div style={{ width: '100%', aspectRatio: `${W} / ${H}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {error ? 'Error' : 'Generating…'}
              </div>
            )}
          </div>

          {!shared ? (
            <div className="share-modal-side">
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Post text</label>
                <textarea
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                  rows={5}
                  maxLength={300}
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder={defaultPostText}
                />
              </div>
              {error && <p className="error-msg" style={{ margin: 0 }}>{error}</p>}
              <div className="form-actions" style={{ marginTop: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleShare}
                  disabled={sharing || !previewUrl}
                >
                  {sharing ? 'Posting…' : 'Post to Bluesky'}
                </button>
              </div>
            </div>
          ) : (
            <div className="share-modal-side" style={{ justifyContent: 'center', alignItems: 'center' }}>
              <p style={{ color: 'var(--accent)', fontWeight: 600 }}>Posted!</p>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
