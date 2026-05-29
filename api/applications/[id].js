import { prepareDb } from '../app.js'
import { isDbConnected, dbUnavailableMessage } from '../lib/db.js'
import {
  deleteApplicationByPublicId,
  getApplicationByPublicId,
} from '../lib/mongoStore.js'
import { requireAdmin, withApi } from '../lib/vercelApi.js'

async function handler(req, res) {
  const id = req.query?.id || req.query?.path?.[0]
  if (!id) {
    return res.status(400).json({ ok: false, message: 'Missing application id' })
  }

  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
  }
  if (!requireAdmin(req, res)) return

  if (req.method === 'GET') {
    const application = await getApplicationByPublicId(id)
    if (!application) return res.status(404).json({ ok: false, message: 'Not found' })
    return res.json({ ok: true, application })
  }

  if (req.method === 'DELETE') {
    const removed = await deleteApplicationByPublicId(id)
    if (!removed) return res.status(404).json({ ok: false, message: 'Not found' })
    return res.json({ ok: true })
  }

  return res.status(405).json({ ok: false, message: 'Method not allowed' })
}

export default withApi(handler, { prepareDbFn: prepareDb })
