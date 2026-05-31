import cookieSession from 'cookie-session'
import { readBearerToken, verifyAdminToken } from './adminToken.js'
import { verifyCandidateToken } from './candidateToken.js'

const APPLICATIONS_CLOSED_MSG =
  'Applications are not open yet. The hiring server must be connected to MongoDB Atlas with an admin account before candidates can apply.'

export { APPLICATIONS_CLOSED_MSG }

export function applyCors(req, res) {
  const origin = req.headers.origin
  const allowed = new Set(
    [process.env.CLIENT_ORIGIN, ...(process.env.CLIENT_ORIGINS || '').split(',')]
      .map((s) => s?.trim())
      .filter(Boolean)
  )
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`)
  if (
    origin &&
    (allowed.has(origin) ||
      /\.vercel\.app$/i.test(origin) ||
      origin.includes('localhost') ||
      /^https?:\/\/([a-z0-9-]+\.)*spinbattles\.com(:\d+)?$/i.test(origin))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (process.env.CLIENT_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN)
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
}

function sessionOptions() {
  const clientIsLocal = (process.env.CLIENT_ORIGIN || '').includes('localhost')
  const crossSite =
    Boolean(process.env.VERCEL) &&
    !clientIsLocal &&
    /spinbattles\.com/i.test(process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || '')
  return {
    name: 'sb_admin_session',
    keys: [process.env.ADMIN_SESSION_SECRET || 'spinbattles-admin-dev-secret'],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: crossSite ? 'none' : 'lax',
    secure: crossSite || (!clientIsLocal && Boolean(process.env.VERCEL)),
  }
}

let sessionMw = null
function getSessionMiddleware() {
  if (!sessionMw) sessionMw = cookieSession(sessionOptions())
  return sessionMw
}

export function runSession(req, res) {
  return new Promise((resolve, reject) => {
    getSessionMiddleware()(req, res, (err) => (err ? reject(err) : resolve()))
  })
}

export async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body)
      } catch {
        return {}
      }
    }
    if (typeof req.body === 'object') return req.body
  }
  if (typeof req.on !== 'function') return {}
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

/** Wrap Vercel handler: CORS, session, optional DB prep. */
export function withApi(handler, { prepareDbFn } = {}) {
  return async (req, res) => {
    applyCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()

    try {
      if (prepareDbFn) await prepareDbFn()
      await runSession(req, res)
      return await handler(req, res)
    } catch (err) {
      console.error('[api]', err)
      if (!res.headersSent) {
        res.status(500).json({ ok: false, message: err.message || 'Server error' })
      }
    }
  }
}

export function getAdminEmail(req) {
  if (req.session?.adminEmail) return req.session.adminEmail
  return verifyAdminToken(readBearerToken(req))
}

export function requireAdmin(req, res) {
  const email = getAdminEmail(req)
  if (!email) {
    res.status(401).json({ ok: false, message: 'Unauthorized' })
    return false
  }
  req.adminEmail = email
  return true
}

export function getCandidateUser(req) {
  const bearer = readBearerToken(req)
  if (bearer) {
    const fromToken = verifyCandidateToken(bearer)
    if (fromToken) return fromToken
  }
  if (req.session?.candidateEmail) {
    return {
      email: req.session.candidateEmail,
      firstName: req.session.candidateFirstName || '',
      lastName: req.session.candidateLastName || '',
    }
  }
  return null
}
