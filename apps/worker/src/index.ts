import { AutoRouter, cors, IRequest } from 'itty-router'
import { Env, TldrawDurableObject } from './TldrawDurableObject.js'
import { StatsDurableObject, StatsEnv } from './StatsDurableObject.js'

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://m-draw-web.vercel.app',
  'http://draw.busyhe.com' // for local development
]

const { preflight, corsify } = cors({
  origin: (origin: string) => (ALLOWED_ORIGINS.includes(origin) ? origin : ''),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
  credentials: true
})
const router = AutoRouter<IRequest, [Env & StatsEnv, ExecutionContext]>()

router.all('*', preflight)

// Sync endpoint
router.get('/connect/:roomId', async (request, env) => {
  try {
    const roomId = request.params.roomId
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(roomId)
    const obj = env.TLDRAW_DURABLE_OBJECT.get(id)
    // Add roomId to query params so Durable Object can access it
    const url = new URL(request.url)
    url.searchParams.set('_roomId', roomId)
    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body
    })
    return await obj.fetch(newRequest)
  } catch (error) {
    console.error('Entry point sync error:', error)
    return new Response(error instanceof Error ? error.message : 'Durable Object Fetch Error', { status: 500 })
  }
})

// Asset storage
router.get('/assets/:id', async (request, env) => {
  const object = await env.R2_BUCKET.get(`assets/${request.params.id}`)
  if (!object) return new Response('Object Not Found', { status: 404 })

  const origin = request.headers.get('Origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ''

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('etag', object.httpEtag)

  return new Response(object.body, { headers })
})

router.post('/assets/:id', async (request, env) => {
  await env.R2_BUCKET.put(`assets/${request.params.id}`, request.body, {
    httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' }
  })
  return corsify(new Response('OK'))
})

// Stats endpoints
router.get('/stats/total', async (request, env) => {
  const id = env.STATS_DURABLE_OBJECT.idFromName('global')
  const obj = env.STATS_DURABLE_OBJECT.get(id)
  return await obj.fetch(new Request(request.url, { method: 'GET' }))
})

router.get('/stats/room', async (request, env) => {
  const id = env.STATS_DURABLE_OBJECT.idFromName('global')
  const obj = env.STATS_DURABLE_OBJECT.get(id)
  return await obj.fetch(new Request(request.url, { method: 'GET' }))
})

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      const response = await router.fetch(request, env, ctx)

      // If it's a WebSocket upgrade, return it directly to preserve the webSocket property.
      // Cloning the response via new Response() loses the webSocket attachment.
      if (response.status === 101 || response.webSocket) {
        console.log('Returning WebSocket Response (101)')
        return response
      }

      // Re-create response to ensure headers are mutable for CORS
      const mutableResponse = new Response(response.body, response)
      return corsify(mutableResponse)
    } catch (error) {
      console.error('Global Worker Error:', error)
      return corsify(new Response(error instanceof Error ? error.message : 'Unknown Error', { status: 500 }))
    }
  }
}

export { TldrawDurableObject, StatsDurableObject }
