import dotenv from 'dotenv'
import { connectDb } from '../lib/db.js'
import { ensureDefaultAdmin } from '../lib/mongoStore.js'

dotenv.config()

async function main() {
  await connectDb()
  const email = await ensureDefaultAdmin()
  console.log(`Done. Sign in at /admin-mateoandres-spinbattles/signin with ${email}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
