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
      category TEXT,
      recurrence TEXT DEFAULT 'none',
      completed_dates TEXT[] DEFAULT '{}',
      excluded_dates TEXT[] DEFAULT '{}',
      is_event BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Migration: Add category column if it doesn't exist
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'category'
      ) THEN
        ALTER TABLE todos ADD COLUMN category TEXT;
      END IF;
    END $$;
  `;

  // Migration: Add original_date and overdue columns for overdue task tracking
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'original_date'
      ) THEN
        ALTER TABLE todos ADD COLUMN original_date TEXT;
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'overdue'
      ) THEN
        ALTER TABLE todos ADD COLUMN overdue BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
  `;

  // Migration: Add sort_order column for drag-drop reordering
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'sort_order'
      ) THEN
        ALTER TABLE todos ADD COLUMN sort_order INTEGER;
      END IF;
    END $$;
  `;

  // Migration: Add assigned_to field for task assignments
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'assigned_to_user_id'
      ) THEN
        ALTER TABLE todos ADD COLUMN assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `;

  // Migration: Add backlog_month column for backlog task month grouping
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'backlog_month'
      ) THEN
        ALTER TABLE todos ADD COLUMN backlog_month TEXT;
      END IF;
    END $$;
  `;

  // Migration: Add recurrence_days column for custom day-of-week recurrence
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'recurrence_days'
      ) THEN
        ALTER TABLE todos ADD COLUMN recurrence_days INTEGER[];
      END IF;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      store_id TEXT,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shopping_stores (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopping_stores_user ON shopping_stores(user_id)`;

  // Migration: Rename category to store_id if needed
  await sql`
    DO $$ 
    BEGIN 
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' AND column_name = 'category'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' AND column_name = 'store_id'
      ) THEN
        ALTER TABLE shopping_items RENAME COLUMN category TO store_id;
      END IF;
    END $$;
  `;

  // Migration: Add sort_order column for drag-drop reordering
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' AND column_name = 'sort_order'
      ) THEN
        ALTER TABLE shopping_items ADD COLUMN sort_order INTEGER;
      END IF;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      body_part TEXT NOT NULL,
      sets INTEGER DEFAULT 3,
      reps INTEGER DEFAULT 10,
      weight REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS body_parts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      color TEXT DEFAULT '#FFFFFF',
      sort_order INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS todo_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_todo_categories_user ON todo_categories(user_id)`;

  // Migration: Add sort_order column for drag-drop reordering
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercises' AND column_name = 'sort_order'
      ) THEN
        ALTER TABLE exercises ADD COLUMN sort_order INTEGER;
      END IF;
    END $$;
  `;

  // User connections - bidirectional relationships for sharing/assigning
  await sql`
    CREATE TABLE IF NOT EXISTS user_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connected_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, connected_user_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_connections_user ON user_connections(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_connections_connected ON user_connections(connected_user_id)`;

  // Shopping list sharing - tracks who shares their list with whom (legacy, kept for backwards compat)
  await sql`
    CREATE TABLE IF NOT EXISTS shopping_shares (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_with_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(owner_id, shared_with_id)
    )
  `;

  // Shopping audit history - tracks all changes
  await sql`
    CREATE TABLE IF NOT EXISTS shopping_audit (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      item_name TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopping_audit_user ON shopping_audit(user_id)`;

  // Period tracking tables
  await sql`
    CREATE TABLE IF NOT EXISTS period_cycles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS period_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      average_cycle_length INTEGER DEFAULT 28,
      average_period_length INTEGER DEFAULT 5,
      notify_days_before INTEGER DEFAULT 2,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // User settings table (module configuration)
  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled_modules TEXT[] DEFAULT ARRAY['todos', 'shopping', 'workout', 'period', 'notes'],
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Migration: Add 'notes' to existing user_settings if not present
  await sql`
    UPDATE user_settings
    SET enabled_modules = array_append(enabled_modules, 'notes'),
        updated_at = NOW()
    WHERE NOT ('notes' = ANY(enabled_modules))
  `;

  // Workout sessions table
  await sql`
    CREATE TABLE IF NOT EXISTS workout_sessions (
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id)`;

  // Migration: Add new columns to workout_sessions if they don't exist
  await sql`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workout_sessions' AND column_name = 'body_part_id'
      ) THEN
        ALTER TABLE workout_sessions ADD COLUMN body_part_id TEXT;
        ALTER TABLE workout_sessions ADD COLUMN body_part_name TEXT;
        ALTER TABLE workout_sessions ADD COLUMN start_time TEXT;
        ALTER TABLE workout_sessions ADD COLUMN end_time TEXT;
        ALTER TABLE workout_sessions ADD COLUMN duration INTEGER DEFAULT 0;
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workout_sessions' AND column_name = 'date'
      ) THEN
        ALTER TABLE workout_sessions ADD COLUMN date TEXT;
        UPDATE workout_sessions SET date = COALESCE(start_time, created_at::TEXT) WHERE date IS NULL;
        ALTER TABLE workout_sessions ALTER COLUMN date SET NOT NULL;
      END IF;
    END $$;
  `;

  // Push notification subscriptions
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)`;

  // Create indexes for user_id lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopping_user ON shopping_items(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bodyparts_user ON body_parts(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_periods_user ON period_cycles(user_id)`;
}

// Helper to verify JWT and get user ID from request
export function getUserIdFromRequest(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

// Generate JWT token (7 day expiration for security)
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET!, { expiresIn: '7d' });
}

export { sql, JWT_SECRET };
