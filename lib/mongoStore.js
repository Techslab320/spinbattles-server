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

function normalizeFileBlob(file, maxBytes, label) {
  if (!file?.data || !file?.fileName) return undefined
  const data =
    typeof file.data === 'string' ? Buffer.from(file.data, 'base64') : Buffer.from(file.data)
  if (data.length > maxBytes) {
    throw new Error(`${label} exceeds size limit`)
  }
  return {
    fileName: String(file.fileName),
    mimeType: String(file.mimeType || 'application/octet-stream'),
    size: Number(file.size) || data.length,
    data,
  }
}

function normalizeResume(resume) {
  return normalizeFileBlob(resume, 4 * 1024 * 1024, 'Resume file')
}

function normalizeAvatar(avatar) {
  return normalizeFileBlob(avatar, 2 * 1024 * 1024, 'Avatar image')
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
    avatar: normalizeAvatar(entry.avatar),
    submittedAt: entry.submittedAt ? new Date(entry.submittedAt) : new Date(),
  })
  return doc.toApiShape(true)
}

export async function listApplications() {
  const docs = await Application.find().sort({ submittedAt: -1 })
  return docs.map((d) => d.toApiShape(false))
}

export async function getApplicationByPublicId(publicId, { includeResumeData = false } = {}) {
  const doc = await Application.findOne({ publicId })
  return doc ? doc.toApiShape(true, includeResumeData) : null
}

export async function deleteApplicationByPublicId(publicId) {
  const result = await Application.deleteOne({ publicId })
  return result.deletedCount > 0
}
