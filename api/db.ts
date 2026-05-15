import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

// Get the SQL function from Neon
const sql = neon(process.env.DATABASE_URL!);

// JWT secret must be configured in environment - no fallback for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be configured');
}

// Initialize database tables. Each statement must be its own call — the Neon
// HTTP driver uses prepared statements which reject multi-command strings.
export async function initDb() {
  // ── Users ────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Todos ────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    date TEXT NOT NULL,
    time TEXT,
    priority TEXT DEFAULT 'medium',
    category TEXT,
    recurrence TEXT DEFAULT 'none',
    completed_dates TEXT[] DEFAULT '{}',
    excluded_dates TEXT[] DEFAULT '{}',
    is_event BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Shopping ─────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS shopping_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    store_id TEXT,
    completed BOOLEAN DEFAULT FALSE,
    sort_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS shopping_stores (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Workout ──────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    body_part TEXT NOT NULL,
    sets INTEGER DEFAULT 3,
    reps INTEGER DEFAULT 10,
    weight REAL DEFAULT 0,
    sort_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS body_parts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    body_part_id TEXT,
    body_part_name TEXT,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER DEFAULT 0,
    exercises JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Notes ────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    color TEXT DEFAULT '#FFFFFF',
    sort_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Todos / Categories ───────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS todo_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Social / Connections ─────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS user_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connected_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, connected_user_id)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS shopping_shares (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(owner_id, shared_with_id)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS shopping_audit (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    item_name TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Settings ─────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled_modules TEXT[] DEFAULT ARRAY['todos', 'shopping', 'workout', 'notes'],
    updated_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Recipes ──────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    ingredients JSONB DEFAULT '[]',
    instructions JSONB DEFAULT '[]',
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    tags TEXT[] DEFAULT '{}',
    source_url TEXT,
    source_platform TEXT DEFAULT 'manual',
    thumbnail TEXT,
    channel_name TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    sort_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Auth tokens ──────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
  )`;

  await sql`CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  // ── Indexes ──────────────────────────────────────────────────────────────
  await sql`CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopping_user ON shopping_items(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopping_stores_user ON shopping_stores(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bodyparts_user ON body_parts(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_todo_categories_user ON todo_categories(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_connections_user ON user_connections(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_connections_connected ON user_connections(connected_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopping_audit_user ON shopping_audit(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_evt_user ON email_verification_tokens(user_id)`;

  // ── Rate limiting ────────────────────────────────────────────────────────
  // Keyed by (ip, endpoint, window_start). window_start is the Unix epoch
  // second of the start of the current time bucket. The primary key gives us
  // an atomic upsert via ON CONFLICT so there are no race conditions.
  await sql`CREATE TABLE IF NOT EXISTS auth_rate_limits (
    ip TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    window_start BIGINT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (ip, endpoint, window_start)
  )`;

  // ── Column migrations ────────────────────────────────────────────────────
  // DEFAULT TRUE so existing accounts are treated as already verified.
  // Only new signups go through the verification flow.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE NOT NULL`;
}

// Token lifetimes.
// - Access tokens are short-lived and live only in memory on the client.
// - Refresh tokens are long-lived and stored in an httpOnly cookie.
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
// Refresh-cookie max-age must match REFRESH_TOKEN_TTL (in seconds).
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = 'aa_refresh';

interface AccessClaims { userId: string; type?: 'access' }
interface RefreshClaims { userId: string; type: 'refresh' }

// Helper to verify the access JWT and get user ID from a request's Authorization header.
export function getUserIdFromRequest(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as AccessClaims;
    // Reject refresh tokens used as Bearer credentials.
    if (decoded.type === 'refresh') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

// Verify a refresh token (from the httpOnly cookie). Returns the userId or null.
export function verifyRefreshToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as RefreshClaims;
    if (decoded.type !== 'refresh') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

// Short-lived access token (in-memory on the client).
export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId, type: 'access' }, JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
}

// Long-lived refresh token (httpOnly cookie).
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET!, { expiresIn: REFRESH_TOKEN_TTL });
}

/**
 * Atomically increments the request count for (ip, endpoint) in the current
 * time window and returns true if the caller should be rejected (over limit).
 *
 * Uses x-real-ip from Vercel's edge, which reflects the actual client IP and
 * cannot be spoofed by a forged X-Forwarded-For header.
 */
export async function checkRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  // Floor to the current window boundary.
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const result = await sql`
    INSERT INTO auth_rate_limits (ip, endpoint, window_start, count)
    VALUES (${ip}, ${endpoint}, ${windowStart}, 1)
    ON CONFLICT (ip, endpoint, window_start)
    DO UPDATE SET count = auth_rate_limits.count + 1
    RETURNING count
  `;
  return (result[0].count as number) > limit;
}

export { sql, JWT_SECRET };
