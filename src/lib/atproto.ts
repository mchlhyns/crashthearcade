import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { Agent } from '@atproto/api'

export const HANDLE_RESOLVER = 'https://bsky.social'
export const COLLECTION = 'app.gameplay.game'
const LEGACY_COLLECTION = 'app.minimap.game'

let _client: BrowserOAuthClient | null = null

export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (_client) return _client
  const origin = window.location.origin
  _client = new BrowserOAuthClient({
    handleResolver: HANDLE_RESOLVER,
    clientMetadata: {
      client_id: `${origin}/client-metadata.json`,
      client_name: 'Minimap',
      client_uri: origin,
      redirect_uris: [`${origin}/oauth/callback`],
      scope: 'atproto transition:generic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      dpop_bound_access_tokens: true,
    },
  })
  return _client
}

export async function restoreSession(): Promise<{ agent: Agent; did: string } | null> {
  const client = await getOAuthClient()
  // Try to restore any existing session from storage
  const result = await client.init()
  if (!result) return null
  const agent = new Agent(result.session)
  return { agent, did: result.session.did }
}

export async function signIn(handle: string): Promise<void> {
  const client = await getOAuthClient()
  await client.signInRedirect(handle)
  // Browser will redirect to PDS authorization page
}

export async function signOut(did: string): Promise<void> {
  const client = await getOAuthClient()
  await client.revoke(did)
}

export async function migrateLegacyRecords(agent: Agent, did: string): Promise<void> {
  let cursor: string | undefined
  const toMigrate: { uri: string; value: Record<string, unknown> }[] = []

  do {
    const res = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: LEGACY_COLLECTION,
      limit: 100,
      cursor,
    })
    for (const record of res.data.records) {
      toMigrate.push({ uri: record.uri, value: record.value as Record<string, unknown> })
    }
    cursor = res.data.cursor
  } while (cursor)

  if (toMigrate.length === 0) return

  for (const { uri, value } of toMigrate) {
    try {
      await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: COLLECTION,
        record: { ...value, $type: COLLECTION },
      })
      const rkey = uri.split('/').pop()!
      await agent.com.atproto.repo.deleteRecord({ repo: did, collection: LEGACY_COLLECTION, rkey })
    } catch {
      // Skip records that fail — don't block the rest
    }
  }
}
