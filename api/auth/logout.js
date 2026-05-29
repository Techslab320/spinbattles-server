import { withApi } from '../../lib/vercelApi.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }
  req.session = null
  return res.json({ ok: true })
}

export default withApi(handler)
