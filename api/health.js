import { connectDb, isDbConnected, dbUnavailableMessage } from '../lib/db.js'
import { ensureDefaultAdmin, hasAnyAdmin } from '../lib/mongoStore.js'
import { applyCors } from '../lib/vercelApi.js'

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
