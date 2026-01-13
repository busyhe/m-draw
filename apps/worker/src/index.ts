import { AutoRouter, cors, IRequest } from 'itty-router'
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
  const allowedOrigin = isAllowedOrigin(origin)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin)
    headers.set('Access-Control-Allow-Credentials', 'true')
  }
  headers.set('etag', object.httpEtag)

  return new Response(object.body, { headers })
})

router.post('/assets/:id', async (request, env) => {
  await env.R2_BUCKET.put(`assets/${request.params.id}`, request.body, {
    httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' }
  })
  return corsify(new Response('OK'), request)
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
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      const response = await router.fetch(request, env, ctx)

      // Return WebSocket upgrade directly to preserve the webSocket property
      if (response.status === 101 || response.webSocket) {
        return response
      }

      // Re-create response to ensure headers are mutable for CORS
      const mutableResponse = new Response(response.body, response)
      return corsify(mutableResponse, request)
    } catch (error) {
      console.error('Global Worker Error:', error)
      return corsify(new Response(error instanceof Error ? error.message : 'Unknown Error', { status: 500 }), request)
    }
  }
}

export { TldrawDurableObject, StatsDurableObject }
