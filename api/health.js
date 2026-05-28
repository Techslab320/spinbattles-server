import { connectDb, isDbConnected, dbUnavailableMessage } from '../lib/db.js'
import { ensureDefaultAdmin, hasAnyAdmin } from '../lib/mongoStore.js'

function applyCors(req, res) {
  const origin = req.headers.origin
  const allowed = new Set(
    [process.env.CLIENT_ORIGIN, ...(process.env.CLIENT_ORIGINS || '').split(',')]
      .map((s) => s?.trim())
      .filter(Boolean)
  )
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`)
  if (
    origin &&
    (allowed.has(origin) || /\.vercel\.app$/i.test(origin) || origin.includes('localhost'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (process.env.CLIENT_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN)
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
}

export default async function handler(req, res) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    await connectDb()
    await ensureDefaultAdmin()
    const database = isDbConnected() ? 'connected' : 'disconnected'
    let adminReady = false
    if (database === 'connected') {
      try {
        adminReady = await hasAnyAdmin()
      } catch {
        adminReady = false
      }
    }
    const acceptingApplications = database === 'connected' && adminReady
    return res.status(200).json({
      ok: acceptingApplications,
      database,
      adminReady,
      acceptingApplications,
      storage: 'mongodb-atlas',
    })
  } catch (err) {
    console.error('[api/health]', err.message)
    return res.status(503).json({
      ok: false,
      database: 'disconnected',
      adminReady: false,
      acceptingApplications: false,
      storage: 'mongodb-atlas',
      message: err.message || dbUnavailableMessage(),
    })
  }
}
