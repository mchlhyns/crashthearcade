import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { Agent } from '@atproto/api'

export const HANDLE_RESOLVER = 'https://api.bsky.app'
export const COLLECTION = 'app.crashthearcade.game'
export const SETTINGS_COLLECTION = 'app.crashthearcade.settings'
export const LIST_COLLECTION = 'app.crashthearcade.list'

let _client: BrowserOAuthClient | null = null

export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (_client) return _client
  const origin = window.location.origin
  _client = new BrowserOAuthClient({
    handleResolver: HANDLE_RESOLVER,
    clientMetadata: {
      client_id: `${origin}/oauth-client-metadata.json`,
      client_name: 'CRASH THE ARCADE',
      client_uri: origin,
      redirect_uris: [`${origin}/oauth/callback`],
      scope: 'atproto repo:app.crashthearcade.game repo:app.crashthearcade.settings repo:app.crashthearcade.list repo:app.bsky.feed.post blob:image/*',
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
