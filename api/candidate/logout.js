import { withApi } from '../../lib/vercelApi.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  if (req.session?.candidateEmail) {
    req.session = req.session.adminEmail ? { adminEmail: req.session.adminEmail } : null
  }
  return res.json({ ok: true })
}

export default withApi(handler)
