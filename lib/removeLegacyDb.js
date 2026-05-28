import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const LEGACY_DB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db.json')

/** This project uses MongoDB Atlas only — remove stray db.json if present. */
export function removeLegacyDbFile() {
  if (!fs.existsSync(LEGACY_DB)) return
  try {
    fs.unlinkSync(LEGACY_DB)
    console.log('[api] Removed legacy server/db.json (MongoDB Atlas is the only database).')
  } catch (err) {
    console.warn('[api] Could not remove server/db.json:', err.message)
  }
}
