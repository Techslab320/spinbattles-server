import mongoose from 'mongoose'

export async function connectDb() {
  const uri = process.env.MONGODB_URI
  if (!uri || uri.includes('YOUR_MONGODB_PASSWORD')) {
    throw new Error(
      'Set MONGODB_URI in .env with your Atlas password (mongodb+srv://spinbattles_admin:...@cluster0.xgvjstu.mongodb.net/spinbattles)'
    )
  }

  mongoose.set('strictQuery', true)
  await mongoose.connect(uri)
  console.log('[db] Connected to MongoDB Atlas')
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1
}

export function dbUnavailableMessage() {
  return (
    'Database is not connected. In MongoDB Atlas → Network Access, add your current IP (or 0.0.0.0/0 for dev), ' +
    'wait until Active, verify MONGODB_URI in .env, then restart: npm run dev'
  )
}
