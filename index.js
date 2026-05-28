import express from 'express'
import cookieSession from 'cookie-session'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'
import { connectDb, dbUnavailableMessage, isDbConnected } from './lib/db.js'
import { removeLegacyDbFile } from './lib/removeLegacyDb.js'
import { verifyPassword } from './lib/password.js'
import {
  createApplication,
  deleteApplicationByPublicId,
  ensureDefaultAdmin,
  hasAnyAdmin,
  getAdminByEmail,
  getApplicationByPublicId,
  listApplications,
} from './lib/mongoStore.js'

dotenv.config()

const app = express()
const PORT = process.env.API_PORT || 3002
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000'
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'spinbattles-admin-dev-secret'

const APPLICATIONS_CLOSED_MSG =
  'Applications are not open yet. The hiring server must be connected to MongoDB Atlas with an admin account before candidates can apply.'

app.use(express.json({ limit: '8mb' }))

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(
  cookieSession({
    name: 'sb_admin_session',
    keys: [SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
)

function requireDb(req, res, next) {
  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
  }
  next()
}

async function requireHiringOpen(req, res, next) {
  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: APPLICATIONS_CLOSED_MSG })
  }
  try {
    if (!(await hasAnyAdmin())) {
      return res.status(503).json({ ok: false, message: APPLICATIONS_CLOSED_MSG })
    }
  } catch {
    return res.status(503).json({ ok: false, message: APPLICATIONS_CLOSED_MSG })
  }
  next()
}

function requireAdmin(req, res, next) {
  if (!req.session?.adminEmail) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' })
  }
  next()
}

async function getServerStatus() {
  const database = isDbConnected() ? 'connected' : 'disconnected'
  let adminReady = false
  if (database === 'connected') {
    try {
      adminReady = await hasAnyAdmin()
    } catch {
      adminReady = false
    }
  }
  return {
    database,
    adminReady,
    acceptingApplications: database === 'connected' && adminReady,
  }
}

app.get('/api/health', async (_req, res) => {
  const status = await getServerStatus()
  res.json({
    ok: status.acceptingApplications,
    ...status,
    storage: 'mongodb-atlas',
  })
})

app.post('/api/auth/login', requireDb, async (req, res) => {
  try {
    if (!(await hasAnyAdmin())) {
      await ensureDefaultAdmin()
    }

    const { email, password } = req.body || {}
    const admin = await getAdminByEmail(email)
    if (!admin || !verifyPassword(String(password || ''), admin.passwordHash)) {
      return res.status(401).json({ ok: false, message: 'Invalid email or password' })
    }
    req.session.adminEmail = admin.email
    res.json({ ok: true, email: admin.email })
  } catch (err) {
    console.error('[auth/login]', err)
    res.status(500).json({ ok: false, message: 'Login failed' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  req.session = null
  res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
  if (!req.session?.adminEmail) {
    return res.status(401).json({ ok: false })
  }
  res.json({ ok: true, email: req.session.adminEmail })
})

app.post('/api/applications', requireHiringOpen, async (req, res) => {
  try {
    const { type, title, applicantName, applicantEmail, sections, resume } = req.body || {}
    if (!type || !applicantName?.trim() || !applicantEmail?.trim()) {
      return res.status(400).json({ ok: false, message: 'Missing required application fields' })
    }

    const entry = await createApplication({
      id: randomUUID(),
      type: String(type),
      title: String(title || type),
      applicantName: String(applicantName).trim(),
      applicantEmail: String(applicantEmail).trim(),
      sections: Array.isArray(sections) ? sections : [],
      resume: resume || undefined,
      submittedAt: new Date().toISOString(),
    })

    res.status(201).json({ ok: true, id: entry.id })
  } catch (err) {
    console.error('[applications POST]', err)
    res.status(500).json({ ok: false, message: 'Failed to save application' })
  }
})

app.get('/api/applications', requireDb, requireAdmin, async (_req, res) => {
  try {
    const applications = await listApplications()
    res.json({ ok: true, applications })
  } catch (err) {
    console.error('[applications GET]', err)
    res.status(500).json({ ok: false, message: 'Failed to load applications' })
  }
})

app.get('/api/applications/:id', requireDb, requireAdmin, async (req, res) => {
  try {
    const application = await getApplicationByPublicId(req.params.id)
    if (!application) return res.status(404).json({ ok: false, message: 'Not found' })
    res.json({ ok: true, application })
  } catch (err) {
    console.error('[applications GET :id]', err)
    res.status(500).json({ ok: false, message: 'Failed to load application' })
  }
})

app.delete('/api/applications/:id', requireDb, requireAdmin, async (req, res) => {
  try {
    const removed = await deleteApplicationByPublicId(req.params.id)
    if (!removed) return res.status(404).json({ ok: false, message: 'Not found' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[applications DELETE]', err)
    res.status(500).json({ ok: false, message: 'Failed to delete application' })
  }
})

async function start() {
  removeLegacyDbFile()

  try {
    await connectDb()
    await ensureDefaultAdmin()
    if (!(await hasAnyAdmin())) {
      throw new Error('Admin account was not created in MongoDB')
    }
    console.log('[api] MongoDB Atlas ready — applications and admin login are enabled')
  } catch (err) {
    console.error('[api] FATAL: Cannot start without MongoDB Atlas.')
    console.error('[api]', err.message)
    console.error('[api] Fix MONGODB_URI in .env, allow your IP in Atlas Network Access, then run: npm run dev')
    console.error('[api] No db.json is used. Applications stay closed until the server starts successfully.')
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`[api] Listening on http://localhost:${PORT} (MongoDB Atlas only)`)
    console.log(`[api] Health: http://localhost:${PORT}/api/health`)
  })
}

start()
