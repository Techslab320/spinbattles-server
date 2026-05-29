import { randomUUID } from 'crypto'
import { prepareDb } from '../app.js'
import { isDbConnected, dbUnavailableMessage } from '../lib/db.js'
import { createApplication, hasAnyAdmin, listApplications } from '../lib/mongoStore.js'
import { APPLICATIONS_CLOSED_MSG, readJsonBody, requireAdmin, withApi } from '../lib/vercelApi.js'

async function handler(req, res) {
  if (req.method === 'GET') {
    if (!isDbConnected()) {
      return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
    }
    if (!requireAdmin(req, res)) return
    const applications = await listApplications()
    return res.json({ ok: true, applications })
  }

  if (req.method === 'POST') {
    if (!isDbConnected()) {
      return res.status(503).json({ ok: false, message: APPLICATIONS_CLOSED_MSG })
    }
    if (!(await hasAnyAdmin())) {
      return res.status(503).json({ ok: false, message: APPLICATIONS_CLOSED_MSG })
    }

    const body = await readJsonBody(req)
    const { type, title, applicantName, applicantEmail, sections, resume } = body || {}
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

    return res.status(201).json({ ok: true, id: entry.id })
  }

  return res.status(405).json({ ok: false, message: 'Method not allowed' })
}

export default withApi(handler, { prepareDbFn: prepareDb })
