import mongoose from 'mongoose'

const globalCache = globalThis

function getCache() {
  if (!globalCache._mongooseCache) {
    globalCache._mongooseCache = { conn: null, promise: null }
  }
  return globalCache._mongooseCache
}

export async function connectDb() {
  const uri = process.env.MONGODB_URI
  if (!uri || uri.includes('YOUR_MONGODB_PASSWORD')) {
    throw new Error(
      'Set MONGODB_URI in Vercel Environment Variables (or .env locally) with your Atlas connection string.'
    )
  }

  const cache = getCache()
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn
  }

  if (!cache.promise) {
    mongoose.set('strictQuery', true)
    cache.promise = mongoose.connect(uri).then((m) => {
      console.log('[db] Connected to MongoDB Atlas')
      return m
    })
  }

  cache.conn = await cache.promise
  return cache.conn
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1
}

export function dbUnavailableMessage() {
  return (
    'Database is not connected. In MongoDB Atlas → Network Access, allow 0.0.0.0/0 (required for Vercel), ' +
    'verify MONGODB_URI is set in Vercel project settings, then redeploy.'
  )
}
