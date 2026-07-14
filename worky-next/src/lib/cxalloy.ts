import { createHmac } from 'node:crypto'

const apiBase = 'https://tq.cxalloy.com/api/v1'

function credentials() {
  const identifier = process.env.CXALLOY_API_IDENTIFIER
  const secret = process.env.CXALLOY_API_SECRET
  if (!identifier || !secret) throw new Error('CxAlloy API credentials are not configured on the server.')
  return { identifier, secret }
}

export async function cxalloyGet<T>(path: string): Promise<T> {
  const { identifier, secret } = credentials()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex')
  const response = await fetch(`${apiBase}${path}`, { headers: cxHeaders(identifier, timestamp, signature) })
  if (!response.ok) throw new Error(`CxAlloy request failed (${response.status}): ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function cxalloyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { identifier, secret } = credentials()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const json = JSON.stringify(body)
  const signature = createHmac('sha256', secret).update(json + timestamp).digest('hex')
  const response = await fetch(`${apiBase}${path}`, { method: 'POST', headers: cxHeaders(identifier, timestamp, signature), body: json })
  if (!response.ok) throw new Error(`CxAlloy request failed (${response.status}): ${await response.text()}`)
  return response.json() as Promise<T>
}

function cxHeaders(identifier: string, timestamp: string, signature: string) {
  return {
    'Content-Type': 'application/json',
    'cxalloy-identifier': identifier,
    'cxalloy-signature': signature,
    'cxalloy-timestamp': timestamp,
    'User-Agent': 'XNRGY-Site-Intelligence/1.0',
  }
}
