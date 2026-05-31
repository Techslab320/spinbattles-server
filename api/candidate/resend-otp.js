import { prepareDb } from '../../app.js'
import { getCandidateByEmail, setCandidateOtp } from '../../lib/mongoStore.js'
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

  const { email } = await readJsonBody(req)
  if (!email?.trim()) {
    return res.status(400).json({ ok: false, message: 'Email is required' })
  }

  try {
    const candidate = await getCandidateByEmail(email.trim())
    if (!candidate) {
      return res.json({ ok: true, message: 'If an account exists, a new code was sent.' })
    }
    if (candidate.emailVerified) {
      return res.status(400).json({ ok: false, message: 'This email is already verified. Please sign in.' })
    }

    const otp = generateOtp()
    await setCandidateOtp(candidate.email, otp)
    await sendOtpEmail({ to: candidate.email, firstName: candidate.firstName, otp })

    return res.json({ ok: true, message: 'Verification code sent to your email.' })
  } catch (err) {
    if (err.message?.includes('Email service is not configured')) {
      return res.status(503).json({ ok: false, message: err.message })
    }
    throw err
  }
}

export default withApi(handler, { prepareDbFn: prepareDb })
