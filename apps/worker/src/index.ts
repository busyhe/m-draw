import { Router, cors, IRequest } from 'itty-router'
import { Env, TldrawDurableObject } from './TldrawDurableObject.js'
import { StatsDurableObject, StatsEnv } from './StatsDurableObject.js'

// Allowed origins for CORS (production)
const ALLOWED_ORIGINS = ['https://m-draw-web.vercel.app', 'https://draw.busyhe.com']

const isAllowedOrigin = (origin: string | undefined): string => {
  if (!origin) return ''
  // Check exact match
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  // Allow any localhost port for development
  if (origin.startsWith('http://localhost:')) return origin
  return ''
}

const { preflight, corsify } = cors({
  origin: isAllowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600
})

const router = Router<IRequest, [Env & StatsEnv, any]>()

router.all('*', preflight)

// Sync endpoint
router.get('/connect/:roomId', async (request, env) => {
  try {
    const roomId = request.params.roomId as string
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

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)

  return new Response(object.body, { headers })
})

router.post('/assets/:id', async (request, env) => {
  try {
    await env.R2_BUCKET.put(`assets/${request.params.id}`, request.body, {
      httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' }
    })
    return new Response('OK')
  } catch (error) {
    console.error('Failed to upload asset:', error)
    return new Response('Upload Failed', { status: 500 })
  }
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

router.post('/stats/heartbeat', async (request, env) => {
  const id = env.STATS_DURABLE_OBJECT.idFromName('global')
  const obj = env.STATS_DURABLE_OBJECT.get(id)
  return await obj.fetch(new Request(request.url, { method: 'POST' }))
})

export default {
  fetch: async (request: Request, env: Env, ctx: any) => {
    try {
      const response = await router.fetch(request, env, ctx)

      // Return WebSocket upgrade directly to preserve the webSocket property
      if (response && (response.status === 101 || (response as any).webSocket)) {
        return response
      }

      // Re-create response to ensure headers are mutable for CORS
      const mutableResponse = new Response(response?.body, response || { status: 404 })
      return corsify(mutableResponse, request)
    } catch (error) {
      console.error('Global Worker Error:', error)
      return corsify(new Response(error instanceof Error ? error.message : 'Unknown Error', { status: 500 }), request)
    }
  }
}

export { TldrawDurableObject, StatsDurableObject }
