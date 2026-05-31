import { getCandidateUser, withApi } from '../../lib/vercelApi.js'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const user = getCandidateUser(req)
  if (!user) {
    return res.status(401).json({ ok: false })
  }
  return res.json({ ok: true, ...user })
}

export default withApi(handler)
