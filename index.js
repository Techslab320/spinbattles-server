import dotenv from 'dotenv'
import { createApp, prepareDb } from './app.js'
import { hasAnyAdmin } from './lib/mongoStore.js'

dotenv.config()

const PORT = Number(process.env.API_PORT) || 3002

async function start() {
  try {
    await prepareDb()
    if (!(await hasAnyAdmin())) {
      throw new Error('Admin account was not created in MongoDB')
    }
    console.log('[api] MongoDB Atlas ready — applications and admin login are enabled')
  } catch (err) {
    console.error('[api] FATAL: Cannot start without MongoDB Atlas.')
    console.error('[api]', err.message)
    console.error('[api] Fix MONGODB_URI in .env, allow your IP in Atlas Network Access, then run: npm run dev')
    process.exit(1)
  }

  const app = createApp()
  app.listen(PORT, () => {
    console.log(`[api] Listening on http://localhost:${PORT} (MongoDB Atlas only)`)
    console.log(`[api] Health: http://localhost:${PORT}/api/health`)
  })
}

start()
