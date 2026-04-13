import { IgdbGame } from '@/types'

/** Convert a date input value (YYYY-MM-DD) to an ISO datetime string for storage */
export function dateInputToISO(value: string): string | undefined {
  if (!value) return undefined
  return new Date(value + 'T00:00:00').toISOString()
}

/** Convert an ISO datetime string to a date input value (YYYY-MM-DD) */
export function isoToDateInput(iso: string | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

/** Format an ISO datetime string for display (e.g. "Jan 2024") */
export function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function normalizeCoverUrl(url: string): string {
  // IGDB returns URLs like //images.igdb.com/igdb/image/upload/t_thumb/...
  // We want t_cover_big for better quality
  return url
    .replace(/^\/\//, 'https://')
    .replace('/t_thumb/', '/t_cover_big/')
}

export function normalizeScreenshotUrl(url: string): string {
  return url
    .replace(/^\/\//, 'https://')
    .replace(/\/t_[^/]+\//, '/t_screenshot_big/')
}

export const COMMON_PLATFORMS = [
  'PC', 'Mac', 'PS5', 'PS4', 'PS3',
  'Xbox Series X/S', 'Xbox One', 'Xbox 360',
  'Nintendo Switch', 'Nintendo Switch 2', 'Wii U', '3DS',
  'iOS', 'Android',
]

const STATUS_LABELS: Record<string, string> = {
  wishlist: 'Wishlisted',
}

/** Return the display label for a game status */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? (status.charAt(0).toUpperCase() + status.slice(1))
}

export function formatIgdbGame(game: IgdbGame): IgdbGame & { coverUrl?: string; screenshotUrl?: string } {
  return {
    ...game,
    coverUrl: game.cover ? normalizeCoverUrl(game.cover.url) : undefined,
    screenshotUrl: game.screenshots?.[0] ? normalizeScreenshotUrl(game.screenshots[0].url) : undefined,
  }
}
