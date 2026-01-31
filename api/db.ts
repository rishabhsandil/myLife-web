import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

// Get the SQL function from Neon
const sql = neon(process.env.DATABASE_URL!);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize database tables
export async function initDb() {
  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT FALSE,
      date TEXT NOT NULL,
      time TEXT,
      priority TEXT DEFAULT 'medium',
      recurrence TEXT DEFAULT 'none',
      completed_dates TEXT[] DEFAULT '{}',
      excluded_dates TEXT[] DEFAULT '{}',
      is_event BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      category TEXT DEFAULT 'freshco',
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      body_part TEXT NOT NULL,
      personal_record REAL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      exercises JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create indexes for user_id lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopping_user ON shopping_items(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_workouts_user ON workout_sessions(user_id)`;
}

// Helper to verify JWT and get user ID from request
export function getUserIdFromRequest(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

// Generate JWT token
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export { sql, JWT_SECRET };
