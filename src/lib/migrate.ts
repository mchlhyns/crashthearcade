import { Agent } from '@atproto/api'
import { restoreSession } from './atproto'

const MIGRATION_KEY = 'cta_migrated_v1'

const COLLECTION_MAP: [string, string][] = [
  ['app.crashthearcade.game', 'com.crashthearcade.game'],
  ['app.crashthearcade.settings', 'com.crashthearcade.settings'],
  ['app.crashthearcade.list', 'com.crashthearcade.list'],
]

async function migrateCollection(
  agent: Agent,
  did: string,
  oldCollection: string,
  newCollection: string,
): Promise<void> {
  const rkeys: string[] = []
  let cursor: string | undefined

  do {
    const res = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: oldCollection,
      limit: 100,
      cursor,
    })

    for (const record of res.data.records) {
      const rkey = record.uri.split('/').pop()!
      const value = { ...(record.value as Record<string, unknown>) }
      if (value.$type === oldCollection) value.$type = newCollection

      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: newCollection,
        rkey,
        record: value,
      })
      rkeys.push(rkey)
    }

    cursor = res.data.cursor
  } while (cursor)

  for (const rkey of rkeys) {
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: did,
        collection: oldCollection,
        rkey,
      })
    } catch {
      // Already deleted — safe to ignore
    }
  }
}

export async function runMigrationIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(MIGRATION_KEY)) return

  const session = await restoreSession()
  if (!session) return

  for (const [oldCol, newCol] of COLLECTION_MAP) {
    await migrateCollection(session.agent, session.did, oldCol, newCol)
  }

  localStorage.setItem(MIGRATION_KEY, 'true')
}
