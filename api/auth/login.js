import { prepareDb } from '../../app.js'
import { verifyPassword } from '../../lib/password.js'
import {
  ensureDefaultAdmin,
  getAdminByEmail,
  hasAnyAdmin,
} from '../../lib/mongoStore.js'
import { isDbConnected, dbUnavailableMessage } from '../../lib/db.js'
import { createAdminToken } from '../../lib/adminToken.js'
import { readJsonBody, withApi } from '../../lib/vercelApi.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
  }
  if (!(await hasAnyAdmin())) await ensureDefaultAdmin()

  const { email, password } = await readJsonBody(req)
  const admin = await getAdminByEmail(email)
  if (!admin || !verifyPassword(String(password || ''), admin.passwordHash)) {
    return res.status(401).json({ ok: false, message: 'Invalid email or password' })
  }
  req.session = { adminEmail: admin.email }
  const token = createAdminToken(admin.email)
  return res.json({ ok: true, email: admin.email, token })
}

export default withApi(handler, { prepareDbFn: prepareDb })
