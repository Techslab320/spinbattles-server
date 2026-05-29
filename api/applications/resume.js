import { prepareDb } from '../../app.js'
import { isDbConnected, dbUnavailableMessage } from '../../lib/db.js'
import { getApplicationByPublicId } from '../../lib/mongoStore.js'
import { requireAdmin, withApi } from '../../lib/vercelApi.js'

function resolveApplicationId(req) {
  let id = req.query?.id
  if (Array.isArray(id)) id = id[0]
  if (id && id !== '[id]') return String(id)

  const raw = req.url || ''
  const match = raw.match(/applications\/([^/?]+)\/resume/)
  if (match?.[1]) return match[1]
  return null
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const id = resolveApplicationId(req)
  if (!id) {
    return res.status(400).json({ ok: false, message: 'Missing application id' })
  }

  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
  }
  if (!requireAdmin(req, res)) return

  const application = await getApplicationByPublicId(id, { includeResumeData: true })
  if (!application?.resume?.data) {
    return res.status(404).json({ ok: false, message: 'No resume file for this application' })
  }

  return res.json({ ok: true, resume: application.resume })
}

export default withApi(handler, { prepareDbFn: prepareDb })
