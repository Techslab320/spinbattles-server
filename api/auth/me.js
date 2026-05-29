import { prepareDb } from '../../app.js'
import { requireAdmin, withApi } from '../../lib/vercelApi.js'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }
  if (!requireAdmin(req, res)) return
  return res.json({ ok: true, email: req.session.adminEmail })
}

export default withApi(handler, { prepareDbFn: prepareDb })
