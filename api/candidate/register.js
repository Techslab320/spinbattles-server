import { prepareDb } from '../../app.js'
import { createCandidate, setCandidateOtp } from '../../lib/mongoStore.js'
import { isDbConnected, dbUnavailableMessage } from '../../lib/db.js'
import { generateOtp } from '../../lib/otp.js'
import { sendOtpEmail } from '../../lib/sendEmail.js'
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
    const otp = generateOtp()
    await setCandidateOtp(user.email, otp)
    await sendOtpEmail({ to: user.email, firstName: user.firstName, otp })

    return res.status(201).json({
      ok: true,
      requiresVerification: true,
      email: user.email,
      message: 'Verification code sent to your email.',
    })
  } catch (err) {
    if (err.message?.includes('already exists') || err.code === 11000) {
      return res.status(409).json({ ok: false, message: 'An account with this email already exists' })
    }
    if (err.message?.includes('Email service is not configured')) {
      return res.status(503).json({ ok: false, message: err.message })
    }
    throw err
  }
}

export default withApi(handler, { prepareDbFn: prepareDb })
