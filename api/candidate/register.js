import { prepareDb } from '../../app.js'
import { createCandidate } from '../../lib/mongoStore.js'
import { isDbConnected, dbUnavailableMessage } from '../../lib/db.js'
import { createCandidateToken } from '../../lib/candidateToken.js'
import { readJsonBody, withApi } from '../../lib/vercelApi.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
  }

  const { email, password, firstName, lastName } = await readJsonBody(req)
  if (!email?.trim() || !password || !firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ ok: false, message: 'All fields are required' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ ok: false, message: 'Password must be at least 8 characters' })
  }

  try {
    const user = await createCandidate({ email, password, firstName, lastName })
    req.session = {
      candidateEmail: user.email,
      candidateFirstName: user.firstName,
      candidateLastName: user.lastName,
    }
    const token = createCandidateToken(user)
    return res.status(201).json({ ok: true, ...user, token })
  } catch (err) {
    if (err.message?.includes('already exists') || err.code === 11000) {
      return res.status(409).json({ ok: false, message: 'An account with this email already exists' })
    }
    throw err
  }
}

export default withApi(handler, { prepareDbFn: prepareDb })
