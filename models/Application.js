import mongoose from 'mongoose'

const sectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    lines: [{ type: String }],
  },
  { _id: false }
)

const resumeSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { _id: false }
)

const applicationSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    applicantName: { type: String, required: true },
    applicantEmail: { type: String, required: true },
    sections: [sectionSchema],
    resume: resumeSchema,
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

function resumeToApi(resume, { includeData = false } = {}) {
  if (!resume?.fileName) return null
  const base = {
    fileName: resume.fileName,
    mimeType: resume.mimeType,
    size: resume.size,
    hasFile: Boolean(resume.data?.length),
  }
  if (includeData && resume.data?.length) {
    return { ...base, data: resume.data.toString('base64') }
  }
  return base
}

applicationSchema.methods.toApiShape = function toApiShape(includeSections = false, includeResumeData = false) {
  const submittedAt = this.submittedAt
    ? this.submittedAt.toISOString()
    : this.createdAt?.toISOString?.() || new Date().toISOString()

  const base = {
    id: this.publicId,
    type: this.type,
    title: this.title,
    applicantName: this.applicantName,
    applicantEmail: this.applicantEmail,
    submittedAt,
  }
  const resume = resumeToApi(this.resume, { includeData: includeResumeData })
  if (includeSections) {
    return {
      ...base,
      sections: this.sections,
      ...(resume ? { resume } : {}),
    }
  }
  if (resume && !includeResumeData) {
    return { ...base, resume: { fileName: resume.fileName, hasFile: resume.hasFile } }
  }
  return base
}

export const Application =
  mongoose.models.Application || mongoose.model('Application', applicationSchema)
