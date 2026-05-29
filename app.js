import express from 'express'
import cookieSession from 'cookie-session'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'
import { connectDb, dbUnavailableMessage, isDbConnected } from './lib/db.js'
import { removeLegacyDbFile } from './lib/removeLegacyDb.js'
import { createAdminToken, readBearerToken, verifyAdminToken } from './lib/adminToken.js'
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

const APPLICATIONS_CLOSED_MSG =
  'Applications are not open yet. The hiring server must be connected to MongoDB Atlas with an admin account before candidates can apply.'

function resolveCorsOrigin(req, res) {
  const origin = req.headers.origin
  const allowed = new Set(
    [process.env.CLIENT_ORIGIN, ...(process.env.CLIENT_ORIGINS || '').split(',')]
      .map((s) => s?.trim())
      .filter(Boolean)
  )

  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`)
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    allowed.add(process.env.VERCEL_PROJECT_PRODUCTION_URL.startsWith('http')
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }

  if (
    origin &&
    (allowed.has(origin) ||
      /\.vercel\.app$/i.test(origin) ||
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

export async function prepareDb() {
  if (!process.env.VERCEL) {
    removeLegacyDbFile()
  }
  await connectDb()
  await ensureDefaultAdmin()
}

export function createApp() {
  const app = express()
  const SESSION_SECRET =
    process.env.ADMIN_SESSION_SECRET || 'spinbattles-admin-dev-secret'

  app.use(express.json({ limit: '8mb' }))

  // Vercel serverless may pass /health instead of /api/health
  app.use((req, _res, next) => {
    const [pathname, query = ''] = (req.url || '').split('?')
    if (!pathname.startsWith('/api')) {
      const suffix = pathname.startsWith('/') ? pathname : `/${pathname}`
      req.url = `/api${suffix}${query ? `?${query}` : ''}`
    }
    next()
  })

  app.use((req, res, next) => {
    resolveCorsOrigin(req, res)
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
      secure:
        !(process.env.CLIENT_ORIGIN || '').includes('localhost') &&
        (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)),
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

  function getAdminEmailFromReq(req) {
    if (req.session?.adminEmail) return req.session.adminEmail
    return verifyAdminToken(readBearerToken(req))
  }

  function requireAdmin(req, res, next) {
    const email = getAdminEmailFromReq(req)
    if (!email) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' })
    }
    req.adminEmail = email
    next()
  }

  app.get('/api/health', async (_req, res) => {
    try {
      await prepareDb()
      const status = await getServerStatus()
      return res.json({
        ok: status.acceptingApplications,
        ...status,
        storage: 'mongodb-atlas',
      })
    } catch (err) {
      console.error('[health]', err.message)
      return res.status(503).json({
        ok: false,
        database: 'disconnected',
        adminReady: false,
        acceptingApplications: false,
        storage: 'mongodb-atlas',
        message: err.message || dbUnavailableMessage(),
      })
    }
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
      req.session = { adminEmail: admin.email }
      const token = createAdminToken(admin.email)
      res.json({ ok: true, email: admin.email, token })
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
    const email = getAdminEmailFromReq(req)
    if (!email) {
      return res.status(401).json({ ok: false })
    }
    res.json({ ok: true, email })
  })

  app.post('/api/applications', requireHiringOpen, async (req, res) => {
    try {
      const { type, title, applicantName, applicantEmail, sections, resume, avatar } = req.body || {}
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
        avatar: avatar || undefined,
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
      const application = await getApplicationByPublicId(req.params.id, { includeResumeData: false })
      if (!application) return res.status(404).json({ ok: false, message: 'Not found' })
      res.json({ ok: true, application })
    } catch (err) {
      console.error('[applications GET :id]', err)
      res.status(500).json({ ok: false, message: 'Failed to load application' })
    }
  })

  app.get('/api/applications/:id/resume', requireDb, requireAdmin, async (req, res) => {
    try {
      const application = await getApplicationByPublicId(req.params.id, { includeResumeData: true })
      if (!application?.resume?.data) {
        return res.status(404).json({ ok: false, message: 'No resume file for this application' })
      }
      res.json({ ok: true, resume: application.resume })
    } catch (err) {
      console.error('[applications GET :id/resume]', err)
      res.status(500).json({ ok: false, message: 'Failed to load resume' })
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

  return app
}
