import fs from 'fs'
import path from 'path'

let _monoRegular: Buffer | undefined
let _monoBold: Buffer | undefined
let _groteskRegular: Buffer | undefined
let _groteskBold: Buffer | undefined

export function getOgFonts() {
  if (!_monoRegular) _monoRegular = fs.readFileSync(path.join(process.cwd(), 'public/fonts/SpaceMono/SpaceMono-Regular.ttf'))
  if (!_monoBold) _monoBold = fs.readFileSync(path.join(process.cwd(), 'public/fonts/SpaceMono/SpaceMono-Bold.ttf'))
  if (!_groteskRegular) _groteskRegular = fs.readFileSync(path.join(process.cwd(), 'public/fonts/SpaceGrotesk/SpaceGrotesk-Regular.ttf'))
  if (!_groteskBold) _groteskBold = fs.readFileSync(path.join(process.cwd(), 'public/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf'))
  return [
    { name: 'SpaceMono', data: _monoRegular as Buffer, weight: 400 as const, style: 'normal' as const },
    { name: 'SpaceMono', data: _monoBold as Buffer, weight: 700 as const, style: 'normal' as const },
    { name: 'SpaceGrotesk', data: _groteskRegular as Buffer, weight: 400 as const, style: 'normal' as const },
    { name: 'SpaceGrotesk', data: _groteskBold as Buffer, weight: 700 as const, style: 'normal' as const },
  ]
}

let _logo: string | undefined

export function getLogoDataUrl(): string {
  if (!_logo) {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public/logo.png'))
    _logo = `data:image/png;base64,${buf.toString('base64')}`
  }
  return _logo
}

// Satori only supports JPEG, PNG, and GIF — WebP/AVIF will crash the renderer.
const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/gif'])

export async function fetchImageAsDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!SUPPORTED.has(mimeType)) return undefined
    const buffer = await res.arrayBuffer()
    return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`
  } catch {
    return undefined
  }
}
