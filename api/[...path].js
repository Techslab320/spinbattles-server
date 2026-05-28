import serverless from 'serverless-http'
import { createApp, prepareDb } from '../app.js'

const app = createApp()
const handle = serverless(app)

export default async function handler(req, res) {
  try {
    await prepareDb()
  } catch (err) {
    console.error('[vercel api] prepareDb:', err.message)
  }
  return handle(req, res)
}

export const config = {
  api: {
    bodyParser: false,
  },
}
