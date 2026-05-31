import { prepareDb } from '../../app.js'
import { verifyCandidateOtp } from '../../lib/mongoStore.js'
import { isDbConnected, dbUnavailableMessage } from '../../lib/db.js'
import { readJsonBody, withApi } from '../../lib/vercelApi.js'

const REASON_MESSAGES = {
  not_found: 'Account not found. Please sign up first.',
  no_otp: 'No verification code found. Please request a new code.',
  expired: 'Verification code expired. Please request a new code.',
  invalid: 'Invalid verification code. Please try again.',
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, message: dbUnavailableMessage() })
  }

  const { email, otp } = await readJsonBody(req)
  if (!email?.trim() || !otp?.trim()) {
    return res.status(400).json({ ok: false, message: 'Email and verification code are required' })
  }

  const result = await verifyCandidateOtp(email.trim(), String(otp).trim())
  if (!result.ok) {
    return res.status(400).json({
      ok: false,
      message: REASON_MESSAGES[result.reason] || 'Verification failed',
    })
  }

  return res.json({
    ok: true,
    verified: true,
    message: 'Email verified successfully. You can sign in now.',
  })
}

export default withApi(handler, { prepareDbFn: prepareDb })
