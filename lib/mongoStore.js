import { randomUUID } from 'crypto'
import { Admin } from '../models/Admin.js'
import { Application } from '../models/Application.js'
import { hashPassword } from './password.js'

const DEFAULT_ADMIN_EMAIL = 'hr@spinbattles.com'
const DEFAULT_ADMIN_PASSWORD = 'wSYTgZkT5N2H@bt'

export function getAdminCredentials() {
  return {
    email: (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim(),
    password: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
  }
}

/** Create or update the HR admin account in MongoDB (runs on every server start). */
export async function ensureDefaultAdmin() {
  const { email, password } = getAdminCredentials()

  if (!email || !password) {
    throw new Error('Admin email and password are required to seed the admin account.')
  }

  await Admin.findOneAndUpdate(
    { email },
    {
      email,
      passwordHash: hashPassword(password),
    },
    { upsert: true, new: true }
  )

  const count = await Admin.countDocuments()
  console.log(`[db] Admin account ready: ${email} (${count} admin record(s) in database)`)
  return email
}

export async function hasAnyAdmin() {
  return (await Admin.countDocuments()) > 0
}

export async function getAdminByEmail(email) {
  return Admin.findOne({ email: String(email).toLowerCase().trim() })
}

function normalizeResume(resume) {
  if (!resume?.data || !resume?.fileName) return undefined
  const data =
    typeof resume.data === 'string' ? Buffer.from(resume.data, 'base64') : Buffer.from(resume.data)
  if (data.length > 4 * 1024 * 1024) {
    throw new Error('Resume file exceeds 4 MB limit')
  }
  return {
    fileName: String(resume.fileName),
    mimeType: String(resume.mimeType || 'application/octet-stream'),
    size: Number(resume.size) || data.length,
    data,
  }
}

export async function createApplication(entry) {
  const doc = await Application.create({
    publicId: entry.id || randomUUID(),
    type: entry.type,
    title: entry.title,
    applicantName: entry.applicantName,
    applicantEmail: entry.applicantEmail,
    sections: entry.sections || [],
    resume: normalizeResume(entry.resume),
    submittedAt: entry.submittedAt ? new Date(entry.submittedAt) : new Date(),
  })
  return doc.toApiShape(true)
}

export async function listApplications() {
  const docs = await Application.find().sort({ submittedAt: -1 })
  return docs.map((d) => d.toApiShape(false))
}

export async function getApplicationByPublicId(publicId) {
  const doc = await Application.findOne({ publicId })
  return doc ? doc.toApiShape(true, true) : null
}

export async function deleteApplicationByPublicId(publicId) {
  const result = await Application.deleteOne({ publicId })
  return result.deletedCount > 0
}
