import { IgdbGame } from '@/types/minimap'

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

export function formatIgdbGame(game: IgdbGame): IgdbGame & { coverUrl?: string } {
  return {
    ...game,
    coverUrl: game.cover ? normalizeCoverUrl(game.cover.url) : undefined,
  }
}
