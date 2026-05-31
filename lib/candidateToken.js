import crypto from 'crypto'

const TTL_MS = 7 * 24 * 60 * 60 * 1000

function secret() {
  return process.env.ADMIN_SESSION_SECRET || 'spinbattles-admin-dev-secret'
}

export function createCandidateToken(user) {
  const exp = Date.now() + TTL_MS
  const payload = JSON.stringify({
    kind: 'candidate',
    email: String(user.email).toLowerCase().trim(),
    firstName: String(user.firstName || '').trim(),
    lastName: String(user.lastName || '').trim(),
    exp,
  })
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function verifyCandidateToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  try {
    const payload = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8')
    const sig = token.slice(dot + 1)
    const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
    if (sig !== expected) return null
    const data = JSON.parse(payload)
    if (data.kind !== 'candidate' || !data.email || Date.now() > Number(data.exp)) return null
    return {
      email: data.email,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
    }
  } catch {
    return null
  }
}
