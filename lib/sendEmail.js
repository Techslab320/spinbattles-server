import nodemailer from 'nodemailer'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      'Email service is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS on the server.'
    )
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendOtpEmail({ to, firstName, otp }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  const transporter = getTransporter()
  const name = firstName?.trim() || 'there'

  await transporter.sendMail({
    from,
    to,
    subject: 'Your SpinBattles verification code',
    text: `Hi ${name},\n\nYour SpinBattles careers portal verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not create an account, you can ignore this email.\n\n— SpinBattles HR`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:520px">
        <p>Hi ${name},</p>
        <p>Your SpinBattles careers portal verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:24px 0">${otp}</p>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#64748b;font-size:14px">If you did not create an account, you can ignore this email.</p>
        <p>— SpinBattles HR</p>
      </div>
    `,
  })
}
