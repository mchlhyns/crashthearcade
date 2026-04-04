import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { Agent } from '@atproto/api'

export const CLIENT_ID = 'https://minimapgg.netlify.app/client-metadata.json'
export const HANDLE_RESOLVER = 'https://bsky.social'
export const COLLECTION = 'app.minimap.game'

let _client: BrowserOAuthClient | null = null

export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (_client) return _client
  _client = await BrowserOAuthClient.load({
    clientId: CLIENT_ID,
    handleResolver: HANDLE_RESOLVER,
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
  await client.signIn(handle, {
    state: window.location.href,
  })
  // Browser will redirect to PDS authorization page
}

export async function signOut(did: string): Promise<void> {
  const client = await getOAuthClient()
  await client.revoke(did)
}
