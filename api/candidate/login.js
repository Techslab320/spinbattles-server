import { prepareDb } from '../../app.js'
import { verifyPassword } from '../../lib/password.js'
import { getCandidateByEmail } from '../../lib/mongoStore.js'
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

  const { email, password } = await readJsonBody(req)
  const candidate = await getCandidateByEmail(email)
  if (!candidate || !verifyPassword(String(password || ''), candidate.passwordHash)) {
    return res.status(401).json({ ok: false, message: 'Invalid email or password' })
  }
  if (candidate.emailVerified === false) {
    return res.status(403).json({
      ok: false,
      requiresVerification: true,
      email: candidate.email,
      message: 'Please verify your email with the OTP code we sent you.',
    })
  }

  const user = {
    email: candidate.email,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
  }
  req.session = {
    candidateEmail: user.email,
    candidateFirstName: user.firstName,
    candidateLastName: user.lastName,
  }
  const token = createCandidateToken(user)
  return res.json({ ok: true, ...user, token })
}

export default withApi(handler, { prepareDbFn: prepareDb })
