import { prepareDb } from '../../app.js'
import { isDbConnected, dbUnavailableMessage } from '../../lib/db.js'
import {
  deleteApplicationByPublicId,
  getApplicationByPublicId,
} from '../../lib/mongoStore.js'
import { requireAdmin, withApi } from '../../lib/vercelApi.js'

function resolveApplicationId(req) {
  let id = req.query?.id
  if (Array.isArray(id)) id = id[0]
  if (id && id !== '[id]') return String(id)

  const raw = req.url || ''
  const match = raw.match(/applications\/([^/?]+)/)
  if (match?.[1] && match[1] !== '[id]' && match[1] !== 'resume') {
    return match[1]
  }
  return null
}

async function handler(req, res) {
  const id = resolveApplicationId(req)
  if (!id) {
    return res.status(400).json({ ok: false, message: 'Missing application id' })
  }

  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
  }
  if (!requireAdmin(req, res)) return

  if (req.method === 'GET') {
    const application = await getApplicationByPublicId(id, { includeResumeData: false })
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
