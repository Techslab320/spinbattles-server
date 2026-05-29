import crypto from 'crypto'

const TTL_MS = 7 * 24 * 60 * 60 * 1000

function secret() {
  return process.env.ADMIN_SESSION_SECRET || 'spinbattles-admin-dev-secret'
}

export function createAdminToken(email) {
  const exp = Date.now() + TTL_MS
  const payload = JSON.stringify({ email: String(email).toLowerCase().trim(), exp })
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  try {
    const payload = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8')
    const sig = token.slice(dot + 1)
    const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
    if (sig !== expected) return null
    const { email, exp } = JSON.parse(payload)
    if (!email || Date.now() > Number(exp)) return null
    return email
  } catch {
    return null
  }
}

export function readBearerToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization
  if (!auth || typeof auth !== 'string') return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}
