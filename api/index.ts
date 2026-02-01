import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { sql, getUserIdFromRequest, generateToken, initDb } from './db.js';

// Default body parts for new users
const DEFAULT_BODY_PARTS = [
  { name: 'Chest/Tri', color: '#EF4444' },
  { name: 'Back/Bi', color: '#6366F1' },
  { name: 'Shoulders', color: '#F59E0B' },
  { name: 'Legs/Core', color: '#EC4899' },
];

const DEFAULT_MODULES = ['todos', 'shopping', 'workout', 'period'];

// Allowed origins for CORS (configure via environment variable)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

// CORS helper with origin validation
function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin && process.env.NODE_ENV !== 'production') {
    // Allow requests without origin in development (e.g., curl, Postman)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the route from query parameter
  const { route } = req.query;
  const routePath = Array.isArray(route) ? route.join('/') : route || '';

  try {
    // ============ INIT ============
    if (routePath === 'init') {
      await initDb();
      return res.status(200).json({ message: 'Database initialized successfully' });
    }

    // ============ AUTH ROUTES (no auth required) ============
    if (routePath === 'auth/login') {
      return handleLogin(req, res);
    }
    if (routePath === 'auth/signup') {
      return handleSignup(req, res);
    }

    // ============ AUTH REQUIRED ROUTES ============
    const userId = getUserIdFromRequest(req);
    
    if (routePath === 'auth/me') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      return handleMe(req, res, userId);
    }

    // All other routes require auth
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Route to appropriate handler
    switch (routePath) {
      case 'todos':
        return handleTodos(req, res, userId);
      case 'shopping':
        return handleShopping(req, res, userId);
      case 'shopping-share':
        return handleShoppingShare(req, res, userId);
      case 'shopping-audit':
        return handleShoppingAudit(req, res, userId);
      case 'exercises':
        return handleExercises(req, res, userId);
      case 'bodyparts':
        return handleBodyParts(req, res, userId);
      case 'workouts':
        return handleWorkouts(req, res, userId);
      case 'periods':
        return handlePeriods(req, res, userId);
      case 'periods/settings':
        return handlePeriodSettings(req, res, userId);
      case 'settings':
        return handleUserSettings(req, res, userId);
      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============ AUTH HANDLERS ============
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = await sql`
    SELECT id, email, name, password_hash FROM users WHERE email = ${email.toLowerCase()}
  `;

  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = users[0];
  const validPassword = await bcrypt.compare(password, user.password_hash as string);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user.id as string);
  return res.status(200).json({
    user: { id: user.id, email: user.email, name: user.name },
    token
  });
}

async function handleSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Strong password policy: 8+ chars, uppercase, lowercase, number
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  }
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one number' });
  }

  const existingUsers = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
  if (existingUsers.length > 0) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  await sql`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${userId}, ${email.toLowerCase()}, ${name}, ${passwordHash})
  `;

  const token = generateToken(userId);
  return res.status(201).json({
    user: { id: userId, email: email.toLowerCase(), name },
    token
  });
}

async function handleMe(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const users = await sql`SELECT id, email, name FROM users WHERE id = ${userId}`;
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ user: users[0] });
}

// ============ TODOS ============
async function handleTodos(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, title, completed, date, time, priority, recurrence,
          completed_dates as "completedDates", excluded_dates as "excludedDates", 
          created_at as "createdAt", category
        FROM todos WHERE user_id = ${userId}
        ORDER BY date ASC, time ASC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category } = req.body;
      await sql`
        INSERT INTO todos (id, user_id, title, completed, date, time, priority, recurrence, completed_dates, excluded_dates, category)
        VALUES (${id}, ${userId}, ${title}, ${completed || false}, ${date}, ${time || null}, ${priority || 'medium'}, ${recurrence || 'none'}, ${completedDates || []}, ${excludedDates || []}, ${category || null})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category } = req.body;
      await sql`
        UPDATE todos SET title = ${title}, completed = ${completed}, 
          date = ${date}, time = ${time || null}, priority = ${priority}, recurrence = ${recurrence},
          completed_dates = ${completedDates || []}, excluded_dates = ${excludedDates || []}, category = ${category || null}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) {
        await sql`DELETE FROM todos WHERE id = ${id as string} AND user_id = ${userId}`;
      }
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ SHOPPING ============
async function handleShopping(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT si.id, si.name, si.quantity, si.category, si.completed, 
          si.created_at as "createdAt", si.user_id as "ownerId",
          u.name as "ownerName",
          CASE WHEN si.user_id = ${userId} THEN true ELSE false END as "isOwn"
        FROM shopping_items si
        JOIN users u ON si.user_id = u.id
        WHERE si.user_id = ${userId}
           OR si.user_id IN (
             SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
             UNION
             SELECT shared_with_id FROM shopping_shares WHERE owner_id = ${userId}
           )
        ORDER BY si.completed ASC, si.created_at DESC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, quantity, category, completed } = req.body;
      await sql`
        INSERT INTO shopping_items (id, user_id, name, quantity, category, completed)
        VALUES (${id}, ${userId}, ${name}, ${quantity || 1}, ${category || 'freshco'}, ${completed || false})
      `;
      await sql`
        INSERT INTO shopping_audit (id, user_id, action, item_name, details)
        VALUES (${Date.now().toString()}, ${userId}, 'added', ${name}, ${`Qty: ${quantity || 1}, Store: ${category || 'freshco'}`})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, quantity, category, completed } = req.body;
      const [currentItem] = await sql`SELECT name, completed FROM shopping_items WHERE id = ${id}`;
      
      await sql`
        UPDATE shopping_items SET name = ${name}, quantity = ${quantity}, category = ${category}, completed = ${completed}
        WHERE id = ${id} AND (user_id = ${userId} OR user_id IN (
          SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
          UNION
          SELECT shared_with_id FROM shopping_shares WHERE owner_id = ${userId}
        ))
      `;
      
      if (currentItem && currentItem.completed !== completed) {
        await sql`
          INSERT INTO shopping_audit (id, user_id, action, item_name, details)
          VALUES (${Date.now().toString()}, ${userId}, ${completed ? 'completed' : 'uncompleted'}, ${name}, NULL)
        `;
      }
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id, clearCompleted } = req.query;
      if (clearCompleted === 'true') {
        const itemsToDelete = await sql`
          SELECT name FROM shopping_items WHERE completed = true 
            AND (user_id = ${userId} OR user_id IN (
              SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
              UNION
              SELECT shared_with_id FROM shopping_shares WHERE owner_id = ${userId}
            ))
        `;
        await sql`
          DELETE FROM shopping_items WHERE completed = true 
            AND (user_id = ${userId} OR user_id IN (
              SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
              UNION
              SELECT shared_with_id FROM shopping_shares WHERE owner_id = ${userId}
            ))
        `;
        if (itemsToDelete.length > 0) {
          await sql`
            INSERT INTO shopping_audit (id, user_id, action, item_name, details)
            VALUES (${Date.now().toString()}, ${userId}, 'cleared', ${`${itemsToDelete.length} items`}, 'Cleared completed items')
          `;
        }
      } else if (id) {
        const [item] = await sql`SELECT name FROM shopping_items WHERE id = ${id as string}`;
        await sql`
          DELETE FROM shopping_items WHERE id = ${id as string}
            AND (user_id = ${userId} OR user_id IN (
              SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
              UNION
              SELECT shared_with_id FROM shopping_shares WHERE owner_id = ${userId}
            ))
        `;
        if (item) {
          await sql`
            INSERT INTO shopping_audit (id, user_id, action, item_name, details)
            VALUES (${Date.now().toString()}, ${userId}, 'deleted', ${item.name}, NULL)
          `;
        }
      }
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ SHOPPING SHARE ============
async function handleShoppingShare(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const sharedWith = await sql`
        SELECT u.id, u.email, u.name, ss.created_at as "sharedAt"
        FROM shopping_shares ss JOIN users u ON ss.shared_with_id = u.id
        WHERE ss.owner_id = ${userId}
      `;
      const sharedBy = await sql`
        SELECT u.id, u.email, u.name, ss.created_at as "sharedAt"
        FROM shopping_shares ss JOIN users u ON ss.owner_id = u.id
        WHERE ss.shared_with_id = ${userId}
      `;
      return res.status(200).json({ sharedWith, sharedBy });
    }
    case 'POST': {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const users = await sql`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`;
      if (users.length === 0) return res.status(404).json({ error: 'User not found' });

      const targetUser = users[0];
      if (targetUser.id === userId) return res.status(400).json({ error: 'Cannot share with yourself' });

      const existing = await sql`
        SELECT id FROM shopping_shares WHERE owner_id = ${userId} AND shared_with_id = ${targetUser.id}
      `;
      if (existing.length > 0) return res.status(400).json({ error: 'Already shared with this user' });

      await sql`
        INSERT INTO shopping_shares (id, owner_id, shared_with_id)
        VALUES (${`share_${Date.now()}`}, ${userId}, ${targetUser.id})
      `;
      return res.status(201).json({ success: true, sharedWith: { id: targetUser.id, email: targetUser.email, name: targetUser.name } });
    }
    case 'DELETE': {
      const { userId: targetUserId } = req.query;
      if (!targetUserId) return res.status(400).json({ error: 'User ID is required' });
      await sql`DELETE FROM shopping_shares WHERE owner_id = ${userId} AND shared_with_id = ${targetUserId as string}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ SHOPPING AUDIT ============
async function handleShoppingAudit(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rows = await sql`
    SELECT sa.id, sa.action, sa.item_name as "itemName", sa.details,
      sa.created_at as "createdAt", u.name as "userName"
    FROM shopping_audit sa JOIN users u ON sa.user_id = u.id
    WHERE sa.user_id = ${userId}
       OR sa.user_id IN (
         SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
         UNION
         SELECT shared_with_id FROM shopping_shares WHERE owner_id = ${userId}
       )
    ORDER BY sa.created_at DESC LIMIT 50
  `;
  return res.status(200).json(rows);
}

// ============ EXERCISES ============
async function handleExercises(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, name, body_part as "bodyPart", sets, reps, weight
        FROM exercises WHERE user_id = ${userId} ORDER BY body_part, name
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, bodyPart, sets, reps, weight } = req.body;
      await sql`
        INSERT INTO exercises (id, user_id, name, body_part, sets, reps, weight)
        VALUES (${id}, ${userId}, ${name}, ${bodyPart}, ${sets || 3}, ${reps || 10}, ${weight || 0})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, bodyPart, sets, reps, weight } = req.body;
      await sql`
        UPDATE exercises SET name = ${name}, body_part = ${bodyPart}, sets = ${sets}, reps = ${reps}, weight = ${weight}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM exercises WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ BODY PARTS ============
async function handleBodyParts(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      let rows = await sql`
        SELECT id, name, color, sort_order as "sortOrder"
        FROM body_parts WHERE user_id = ${userId} ORDER BY sort_order, created_at
      `;
      if (rows.length === 0) {
        for (let i = 0; i < DEFAULT_BODY_PARTS.length; i++) {
          const bp = DEFAULT_BODY_PARTS[i];
          await sql`
            INSERT INTO body_parts (id, user_id, name, color, sort_order)
            VALUES (${`bp_${Date.now()}_${i}`}, ${userId}, ${bp.name}, ${bp.color}, ${i})
          `;
        }
        rows = await sql`
          SELECT id, name, color, sort_order as "sortOrder"
          FROM body_parts WHERE user_id = ${userId} ORDER BY sort_order, created_at
        `;
      }
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        INSERT INTO body_parts (id, user_id, name, color, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${color}, ${sortOrder || 0})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        UPDATE body_parts SET name = ${name}, color = ${color}, sort_order = ${sortOrder || 0}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM body_parts WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ WORKOUTS ============
async function handleWorkouts(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, date, exercises FROM workout_sessions WHERE user_id = ${userId} ORDER BY date DESC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, date, exercises } = req.body;
      await sql`
        INSERT INTO workout_sessions (id, user_id, date, exercises)
        VALUES (${id}, ${userId}, ${date}, ${JSON.stringify(exercises)})
        ON CONFLICT (id) DO UPDATE SET exercises = ${JSON.stringify(exercises)}
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, date, exercises } = req.body;
      await sql`
        UPDATE workout_sessions SET date = ${date}, exercises = ${JSON.stringify(exercises)}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM workout_sessions WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ PERIODS ============
async function handlePeriods(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, start_date as "startDate", end_date as "endDate", created_at as "createdAt"
        FROM period_cycles WHERE user_id = ${userId} ORDER BY start_date DESC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, startDate, endDate } = req.body;
      await sql`
        INSERT INTO period_cycles (id, user_id, start_date, end_date)
        VALUES (${id}, ${userId}, ${startDate}, ${endDate || null})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, startDate, endDate } = req.body;
      await sql`
        UPDATE period_cycles SET start_date = ${startDate}, end_date = ${endDate || null}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM period_cycles WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ PERIOD SETTINGS ============
async function handlePeriodSettings(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT average_cycle_length as "averageCycleLength", average_period_length as "averagePeriodLength",
          notify_days_before as "notifyDaysBefore"
        FROM period_settings WHERE user_id = ${userId}
      `;
      if (rows.length === 0) {
        return res.status(200).json({ averageCycleLength: 28, averagePeriodLength: 5, notifyDaysBefore: 2 });
      }
      return res.status(200).json(rows[0]);
    }
    case 'POST': {
      const { averageCycleLength, averagePeriodLength, notifyDaysBefore } = req.body;
      await sql`
        INSERT INTO period_settings (user_id, average_cycle_length, average_period_length, notify_days_before)
        VALUES (${userId}, ${averageCycleLength}, ${averagePeriodLength}, ${notifyDaysBefore || 2})
        ON CONFLICT (user_id) DO UPDATE SET 
          average_cycle_length = ${averageCycleLength},
          average_period_length = ${averagePeriodLength},
          notify_days_before = ${notifyDaysBefore || 2}
      `;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ USER SETTINGS ============
async function handleUserSettings(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const result = await sql`SELECT enabled_modules FROM user_settings WHERE user_id = ${userId}`;
      if (result.length === 0) {
        return res.json({ enabledModules: DEFAULT_MODULES });
      }
      return res.json({ enabledModules: result[0].enabled_modules || DEFAULT_MODULES });
    }
    case 'POST': {
      const { enabledModules } = req.body;
      const validModules = ['todos', 'shopping', 'workout', 'period'];
      const filteredModules = (enabledModules || []).filter((m: string) => validModules.includes(m));
      if (filteredModules.length === 0) {
        return res.status(400).json({ error: 'At least one module must be enabled' });
      }
      await sql`
        INSERT INTO user_settings (user_id, enabled_modules, updated_at)
        VALUES (${userId}, ${filteredModules}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET enabled_modules = ${filteredModules}, updated_at = NOW()
      `;
      return res.json({ success: true, enabledModules: filteredModules });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
