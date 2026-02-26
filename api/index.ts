import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import OpenAI from 'openai';
import { sql, getUserIdFromRequest, generateToken, initDb } from './db.js';

// Default body parts for new users
const DEFAULT_BODY_PARTS = [
  { name: 'Chest/Tri', color: '#EF4444' },
  { name: 'Back/Bi', color: '#6366F1' },
  { name: 'Shoulders', color: '#F59E0B' },
  { name: 'Legs/Core', color: '#EC4899' },
];

// Default shopping stores for new users
const DEFAULT_SHOPPING_STORES = [
  { name: 'FreshCo', color: '#22C55E' },
  { name: 'Costco', color: '#6366F1' },
  { name: 'Amazon', color: '#F59E0B' },
  { name: 'Other', color: '#64748B' },
];

// Default todo categories for new users
const DEFAULT_TODO_CATEGORIES = [
  { name: '🎂 Birthday', color: '#EC4899' },
  { name: '💊 Medicine', color: '#EF4444' },
  { name: '💪 Workout', color: '#6366F1' },
  { name: '📞 Call', color: '#22C55E' },
  { name: '💼 Work', color: '#F59E0B' },
  { name: '🏠 Home', color: '#8B5CF6' },
];

const DEFAULT_MODULES = ['todos', 'shopping', 'workout', 'notes'];

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
      case 'todo-categories':
        return handleTodoCategories(req, res, userId);
      case 'users/search':
        return handleUserSearch(req, res, userId);
      case 'connections':
        return handleConnections(req, res, userId);
      case 'shopping':
        return handleShopping(req, res, userId);
      case 'shopping-stores':
        return handleShoppingStores(req, res, userId);
      case 'shopping-share':
        return handleShoppingShare(req, res, userId);
      case 'shopping-audit':
        return handleShoppingAudit(req, res, userId);
      case 'exercises':
        return handleExercises(req, res, userId);
      case 'bodyparts':
        return handleBodyParts(req, res, userId);
      case 'notes':
        return handleNotes(req, res, userId);
      case 'workouts':
        return handleWorkouts(req, res, userId);
      case 'settings':
        return handleUserSettings(req, res, userId);
      case 'recipes':
        return handleRecipes(req, res, userId);
      case 'recipes/share':
        return handleRecipeShare(req, res, userId);
      case 'recipes/shared':
        return handleSharedRecipes(req, res, userId);
      case 'recipes/extract':
        return handleRecipeExtract(req, res, userId);
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
        SELECT t.id, t.title, t.completed, t.date, t.time, t.priority, t.recurrence,
          t.completed_dates as "completedDates", t.excluded_dates as "excludedDates", 
          t.created_at as "createdAt", t.category, t.original_date as "originalDate", t.overdue,
          t.sort_order as "sortOrder", t.user_id as "ownerId", t.assigned_to_user_id as "assignedToUserId",
          t.backlog_month as "backlogMonth", t.recurrence_days as "recurrenceDays",
          owner.name as "ownerName", owner.email as "ownerEmail",
          assignee.name as "assigneeName", assignee.email as "assigneeEmail"
        FROM todos t
        JOIN users owner ON t.user_id = owner.id
        LEFT JOIN users assignee ON t.assigned_to_user_id = assignee.id
        WHERE t.user_id = ${userId} OR t.assigned_to_user_id = ${userId}
        ORDER BY t.date ASC, t.time ASC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category, originalDate, overdue, sortOrder, assignedToUserId, backlogMonth, recurrenceDays } = req.body;
      await sql`
        INSERT INTO todos (id, user_id, title, completed, date, time, priority, recurrence, completed_dates, excluded_dates, category, original_date, overdue, sort_order, assigned_to_user_id, backlog_month, recurrence_days)
        VALUES (${id}, ${userId}, ${title}, ${completed || false}, ${date}, ${time || null}, ${priority || 'medium'}, ${recurrence || 'none'}, ${completedDates || []}, ${excludedDates || []}, ${category || null}, ${originalDate || null}, ${overdue || false}, ${sortOrder !== undefined ? sortOrder : null}, ${assignedToUserId || null}, ${backlogMonth || null}, ${recurrenceDays || null})
      `;
      
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category, originalDate, overdue, sortOrder, assignedToUserId, backlogMonth, recurrenceDays } = req.body;
      await sql`
        UPDATE todos SET title = ${title}, completed = ${completed}, 
          date = ${date}, time = ${time || null}, priority = ${priority}, recurrence = ${recurrence},
          completed_dates = ${completedDates || []}, excluded_dates = ${excludedDates || []}, category = ${category || null},
          original_date = ${originalDate || null}, overdue = ${overdue || false}, sort_order = ${sortOrder !== undefined ? sortOrder : null},
          assigned_to_user_id = ${assignedToUserId !== undefined ? assignedToUserId : null},
          backlog_month = ${backlogMonth !== undefined ? backlogMonth : null},
          recurrence_days = ${recurrenceDays || null}
        WHERE id = ${id} AND (user_id = ${userId} OR assigned_to_user_id = ${userId})
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

// ============ USER SEARCH ============
async function handleUserSearch(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  // Only search among connected users
  const users = await sql`
    SELECT u.id, u.name, u.email
    FROM users u
    WHERE u.id IN (
      SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
      UNION
      SELECT user_id FROM user_connections WHERE connected_user_id = ${userId}
    )
    AND LOWER(u.email) LIKE LOWER(${`%${email}%`})
    AND u.id != ${userId}
    LIMIT 10
  `;

  return res.status(200).json(users);
}

// ============ CONNECTIONS ============
async function handleConnections(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Get all connections (bidirectional)
      const connections = await sql`
        SELECT u.id, u.name, u.email, uc.created_at as "connectedAt"
        FROM users u
        INNER JOIN user_connections uc ON (
          (uc.connected_user_id = u.id AND uc.user_id = ${userId})
          OR (uc.user_id = u.id AND uc.connected_user_id = ${userId})
        )
        WHERE u.id != ${userId}
        ORDER BY u.name
      `;
      // Deduplicate (since bidirectional connections may show twice)
      const uniqueConnections = Array.from(
        new Map(connections.map((c) => [c.id, c])).values()
      );
      return res.status(200).json(uniqueConnections);
    }
    case 'POST': {
      // Add connection by email
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      // Find user by exact email
      const users = await sql`
        SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(${email}) AND id != ${userId}
      `;

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const targetUser = users[0];

      // Check if connection already exists
      const existing = await sql`
        SELECT id FROM user_connections 
        WHERE (user_id = ${userId} AND connected_user_id = ${targetUser.id})
           OR (user_id = ${targetUser.id} AND connected_user_id = ${userId})
      `;

      if (existing.length > 0) {
        return res.status(200).json({ 
          success: true, 
          user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
          message: 'Already connected' 
        });
      }

      // Create bidirectional connection
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_1`}, ${userId}, ${targetUser.id})
      `;
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_2`}, ${targetUser.id}, ${userId})
      `;

      return res.status(201).json({ 
        success: true, 
        user: { id: targetUser.id, name: targetUser.name, email: targetUser.email }
      });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Connection user ID required' });
      }

      // Delete both directions
      await sql`
        DELETE FROM user_connections 
        WHERE (user_id = ${userId} AND connected_user_id = ${id})
           OR (user_id = ${id} AND connected_user_id = ${userId})
      `;

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
        SELECT si.id, si.name, si.quantity, si.store_id as "storeId", si.completed, 
          si.created_at as "createdAt", si.user_id as "ownerId",
          u.name as "ownerName", ss.name as "storeName",
          si.sort_order as "sortOrder",
          CASE WHEN si.user_id = ${userId} THEN true ELSE false END as "isOwn"
        FROM shopping_items si
        JOIN users u ON si.user_id = u.id
        LEFT JOIN shopping_stores ss ON si.store_id = ss.id
        WHERE si.user_id = ${userId}
           OR si.user_id IN (
             SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
           )
        ORDER BY si.completed ASC, si.sort_order ASC NULLS LAST, si.created_at DESC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, quantity, storeId, completed, sortOrder } = req.body;
      await sql`
        INSERT INTO shopping_items (id, user_id, name, quantity, store_id, completed, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${quantity || 1}, ${storeId}, ${completed || false}, ${sortOrder !== undefined ? sortOrder : null})
      `;
      await sql`
        INSERT INTO shopping_audit (id, user_id, action, item_name, details)
        VALUES (${Date.now().toString()}, ${userId}, 'added', ${name}, ${`Qty: ${quantity || 1}`})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, quantity, storeId, completed, sortOrder } = req.body;
      // Fetch current state and update in sequence, but combine audit in one flow
      const [currentItem] = await sql`
        UPDATE shopping_items SET name = ${name}, quantity = ${quantity}, store_id = ${storeId}, completed = ${completed}, sort_order = ${sortOrder !== undefined ? sortOrder : null}
        WHERE id = ${id} AND (user_id = ${userId} OR user_id IN (
          SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
        ))
        RETURNING (SELECT completed FROM shopping_items WHERE id = ${id}) as prev_completed,
                  (SELECT user_id FROM shopping_items WHERE id = ${id}) as owner_id
      `;
      
      if (currentItem && currentItem.prev_completed !== completed) {
        // Fire audit + notification without awaiting (fire-and-forget for non-critical)
        sql`
          INSERT INTO shopping_audit (id, user_id, action, item_name, details)
          VALUES (${Date.now().toString()}, ${userId}, ${completed ? 'completed' : 'uncompleted'}, ${name}, NULL)
        `.catch(() => {});
        
      }
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id, clearCompleted, storeName } = req.query;
      if (clearCompleted === 'true') {
        const storeNameFilter = storeName ? storeName as string : null;
        const itemsToDelete = storeNameFilter 
          ? await sql`
              SELECT si.name FROM shopping_items si
              JOIN shopping_stores ss ON si.store_id = ss.id
              WHERE si.completed = true AND ss.name = ${storeNameFilter}
                AND (si.user_id = ${userId} OR si.user_id IN (
                  SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
                ))
            `
          : await sql`
              SELECT name FROM shopping_items WHERE completed = true 
                AND (user_id = ${userId} OR user_id IN (
                  SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
                ))
            `;
        if (storeNameFilter) {
          await sql`
            DELETE FROM shopping_items si
            USING shopping_stores ss
            WHERE si.store_id = ss.id AND si.completed = true AND ss.name = ${storeNameFilter}
              AND (si.user_id = ${userId} OR si.user_id IN (
                SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
              ))
          `;
        } else {
          await sql`
            DELETE FROM shopping_items WHERE completed = true 
              AND (user_id = ${userId} OR user_id IN (
                SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
              ))
          `;
        }
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
              SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
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

// ============ SHOPPING STORES ============
async function handleShoppingStores(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Seed defaults if user has no stores (single query with INSERT...SELECT)
      await sql`
        INSERT INTO shopping_stores (id, user_id, name, color, sort_order)
        SELECT id, ${userId}, name, color, sort_order FROM (
          VALUES 
            ('store_def_' || ${userId} || '_0', 'FreshCo', '#22C55E', 0),
            ('store_def_' || ${userId} || '_1', 'Costco', '#6366F1', 1),
            ('store_def_' || ${userId} || '_2', 'Amazon', '#F59E0B', 2),
            ('store_def_' || ${userId} || '_3', 'Other', '#64748B', 3)
        ) AS defaults(id, name, color, sort_order)
        WHERE NOT EXISTS (SELECT 1 FROM shopping_stores WHERE user_id = ${userId} LIMIT 1)
        ON CONFLICT (id) DO NOTHING
      `;
      // Get stores from user + shared users, deduplicated by name
      const rows = await sql`
        SELECT DISTINCT ON (ss.name) ss.id, ss.name, ss.color, ss.sort_order as "sortOrder"
        FROM shopping_stores ss
        WHERE ss.user_id = ${userId}
           OR ss.user_id IN (
             SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
           )
        ORDER BY ss.name, ss.sort_order
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        INSERT INTO shopping_stores (id, user_id, name, color, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${color}, ${sortOrder || 0})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        UPDATE shopping_stores SET name = ${name}, color = ${color}, sort_order = ${sortOrder || 0}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM shopping_stores WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ TODO CATEGORIES ============
async function handleTodoCategories(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Seed defaults if user has no categories (single query)
      await sql`
        INSERT INTO todo_categories (id, user_id, name, color, sort_order)
        SELECT id, ${userId}, name, color, sort_order FROM (
          VALUES 
            ('cat_def_' || ${userId} || '_0', '🎂 Birthday', '#EC4899', 0),
            ('cat_def_' || ${userId} || '_1', '💊 Medicine', '#EF4444', 1),
            ('cat_def_' || ${userId} || '_2', '💪 Workout', '#6366F1', 2),
            ('cat_def_' || ${userId} || '_3', '📞 Call', '#22C55E', 3),
            ('cat_def_' || ${userId} || '_4', '💼 Work', '#F59E0B', 4),
            ('cat_def_' || ${userId} || '_5', '🏠 Home', '#8B5CF6', 5)
        ) AS defaults(id, name, color, sort_order)
        WHERE NOT EXISTS (SELECT 1 FROM todo_categories WHERE user_id = ${userId} LIMIT 1)
        ON CONFLICT (id) DO NOTHING
      `;
      const ownCategories = await sql`
        SELECT id, name, color, sort_order as "sortOrder"
        FROM todo_categories WHERE user_id = ${userId} ORDER BY sort_order, created_at
      `;
      return res.status(200).json(ownCategories);
    }
    case 'POST': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        INSERT INTO todo_categories (id, user_id, name, color, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${color}, ${sortOrder || 0})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        UPDATE todo_categories SET name = ${name}, color = ${color}, sort_order = ${sortOrder || 0}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM todo_categories WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}


// ============ SHOPPING SHARE ============
// This now uses the unified user_connections table
async function handleShoppingShare(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Return connections (bidirectional, so all connections appear as "shared with")
      const connections = await sql`
        SELECT u.id, u.email, u.name, uc.created_at as "sharedAt"
        FROM user_connections uc 
        JOIN users u ON uc.connected_user_id = u.id
        WHERE uc.user_id = ${userId}
      `;
      // For backwards compatibility, return as sharedWith (sharedBy is empty since connections are bidirectional)
      return res.status(200).json({ sharedWith: connections, sharedBy: [] });
    }
    case 'POST': {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const users = await sql`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`;
      if (users.length === 0) return res.status(404).json({ error: 'User not found' });

      const targetUser = users[0];
      if (targetUser.id === userId) return res.status(400).json({ error: 'Cannot connect with yourself' });

      const existing = await sql`
        SELECT id FROM user_connections WHERE user_id = ${userId} AND connected_user_id = ${targetUser.id}
      `;
      if (existing.length > 0) return res.status(400).json({ error: 'Already connected with this user' });

      // Create bidirectional connection
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_1`}, ${userId}, ${targetUser.id})
      `;
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_2`}, ${targetUser.id}, ${userId})
      `;
      return res.status(201).json({ success: true, sharedWith: { id: targetUser.id, email: targetUser.email, name: targetUser.name } });
    }
    case 'DELETE': {
      const { userId: targetUserId } = req.query;
      if (!targetUserId) return res.status(400).json({ error: 'User ID is required' });
      // Remove both directions of the connection
      await sql`DELETE FROM user_connections WHERE user_id = ${userId} AND connected_user_id = ${targetUserId as string}`;
      await sql`DELETE FROM user_connections WHERE user_id = ${targetUserId as string} AND connected_user_id = ${userId}`;
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
         SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
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
        SELECT id, name, body_part as "bodyPart", sets, reps, weight, sort_order as "sortOrder"
        FROM exercises WHERE user_id = ${userId} ORDER BY body_part, sort_order ASC NULLS LAST, name
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, bodyPart, sets, reps, weight, sortOrder } = req.body;
      await sql`
        INSERT INTO exercises (id, user_id, name, body_part, sets, reps, weight, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${bodyPart}, ${sets || 3}, ${reps || 10}, ${weight || 0}, ${sortOrder !== undefined ? sortOrder : null})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, bodyPart, sets, reps, weight, sortOrder } = req.body;
      await sql`
        UPDATE exercises SET name = ${name}, body_part = ${bodyPart}, sets = ${sets}, reps = ${reps}, weight = ${weight}, sort_order = ${sortOrder !== undefined ? sortOrder : null}
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
      // Seed defaults if user has no body parts (single query)
      await sql`
        INSERT INTO body_parts (id, user_id, name, color, sort_order)
        SELECT id, ${userId}, name, color, sort_order FROM (
          VALUES 
            ('bp_def_' || ${userId} || '_0', 'Chest/Tri', '#EF4444', 0),
            ('bp_def_' || ${userId} || '_1', 'Back/Bi', '#6366F1', 1),
            ('bp_def_' || ${userId} || '_2', 'Shoulders', '#F59E0B', 2),
            ('bp_def_' || ${userId} || '_3', 'Legs/Core', '#EC4899', 3)
        ) AS defaults(id, name, color, sort_order)
        WHERE NOT EXISTS (SELECT 1 FROM body_parts WHERE user_id = ${userId} LIMIT 1)
        ON CONFLICT (id) DO NOTHING
      `;
      const rows = await sql`
        SELECT id, name, color, sort_order as "sortOrder"
        FROM body_parts WHERE user_id = ${userId} ORDER BY sort_order, created_at
      `;
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

// ============ NOTES ============
async function handleNotes(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, title, content, color, created_at as "createdAt", updated_at as "updatedAt", sort_order as "sortOrder"
        FROM notes WHERE user_id = ${userId} ORDER BY updated_at DESC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, title, content, color, createdAt, updatedAt, sortOrder } = req.body;
      await sql`
        INSERT INTO notes (id, user_id, title, content, color, created_at, updated_at, sort_order)
        VALUES (${id}, ${userId}, ${title}, ${content || ''}, ${color || '#FFFFFF'}, ${createdAt}, ${updatedAt}, ${sortOrder !== undefined ? sortOrder : null})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, content, color, updatedAt, sortOrder } = req.body;
      await sql`
        UPDATE notes SET title = ${title}, content = ${content}, color = ${color}, updated_at = ${updatedAt}, sort_order = ${sortOrder !== undefined ? sortOrder : null}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM notes WHERE id = ${id as string} AND user_id = ${userId}`;
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
        SELECT id, body_part_id as "bodyPartId", body_part_name as "bodyPartName",
               date, start_time as "startTime", end_time as "endTime", duration,
               exercises, created_at as "createdAt"
        FROM workout_sessions WHERE user_id = ${userId} ORDER BY created_at DESC
      `;
      // Parse exercises JSON
      const parsed = rows.map((r: Record<string, unknown>) => ({
        ...r,
        exercises: typeof r.exercises === 'string' ? JSON.parse(r.exercises as string) : r.exercises,
      }));
      return res.status(200).json(parsed);
    }
    case 'POST': {
      try {
        const { id, bodyPartId, bodyPartName, date: clientDate, startTime, endTime, duration, exercises } = req.body;
        const date = clientDate || (startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        await sql`
          INSERT INTO workout_sessions (id, user_id, date, body_part_id, body_part_name, start_time, end_time, duration, exercises)
          VALUES (${id}, ${userId}, ${date}, ${bodyPartId}, ${bodyPartName}, ${startTime}, ${endTime || null}, ${duration || 0}, ${JSON.stringify(exercises)})
          ON CONFLICT (id) DO UPDATE SET 
            date = ${date},
            body_part_id = ${bodyPartId}, body_part_name = ${bodyPartName},
            start_time = ${startTime}, end_time = ${endTime || null},
            duration = ${duration || 0}, exercises = ${JSON.stringify(exercises)}
        `;
        return res.status(201).json({ success: true });
      } catch (error) {
        console.error('Error saving workout session:', error);
        return res.status(500).json({ error: 'Failed to save workout session', details: error instanceof Error ? error.message : String(error) });
      }
    }
    case 'PUT': {
      const { id, bodyPartId, bodyPartName, date: clientDate, startTime, endTime, duration, exercises } = req.body;
      const date = clientDate || (startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      await sql`
        UPDATE workout_sessions SET 
          date = ${date},
          body_part_id = ${bodyPartId}, body_part_name = ${bodyPartName},
          start_time = ${startTime}, end_time = ${endTime || null},
          duration = ${duration || 0}, exercises = ${JSON.stringify(exercises)}
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

// ============ USER SETTINGS ============
async function handleUserSettings(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const result = await sql`SELECT enabled_modules FROM user_settings WHERE user_id = ${userId}`;
      if (result.length === 0) {
        return res.json({ enabledModules: DEFAULT_MODULES });
      }
      return res.json({ enabledModules: Array.isArray(result[0].enabled_modules) ? result[0].enabled_modules : DEFAULT_MODULES });
    }
    case 'POST': {
      const { enabledModules } = req.body;
      const validModules = ['todos', 'shopping', 'workout', 'notes', 'recipes'];
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

// ============ RECIPES ============
async function handleRecipes(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, title, description,
          ingredients, instructions,
          prep_time as "prepTime", cook_time as "cookTime", servings, tags,
          source_url as "sourceUrl", source_platform as "sourcePlatform",
          thumbnail, channel_name as "channelName",
          is_favorite as "isFavorite", sort_order as "sortOrder",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM recipes WHERE user_id = ${userId} AND shared_with_id IS NULL ORDER BY updated_at DESC
      `;
      return res.status(200).json(rows.map((r: Record<string, unknown>) => ({
        ...r,
        ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients as string) : (r.ingredients || []),
        instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions as string) : (r.instructions || []),
      })));
    }
    case 'POST': {
      const { id, title, description, ingredients, instructions, prepTime, cookTime, servings, tags, sourceUrl, sourcePlatform, thumbnail, channelName, isFavorite, sortOrder, createdAt, updatedAt } = req.body;
      if (sourceUrl) {
        const existing = await sql`SELECT id FROM recipes WHERE user_id = ${userId} AND source_url = ${sourceUrl}`;
        if (existing.length > 0) {
          return res.status(409).json({ error: 'A recipe with this URL already exists.' });
        }
      }
      await sql`
        INSERT INTO recipes (id, user_id, title, description, ingredients, instructions, prep_time, cook_time, servings, tags, source_url, source_platform, thumbnail, channel_name, is_favorite, sort_order, created_at, updated_at)
        VALUES (${id}, ${userId}, ${title}, ${description || null}, ${JSON.stringify(ingredients || [])}, ${JSON.stringify(instructions || [])}, ${prepTime || null}, ${cookTime || null}, ${servings || null}, ${tags || []}, ${sourceUrl || null}, ${sourcePlatform || 'manual'}, ${thumbnail || null}, ${channelName || null}, ${isFavorite || false}, ${sortOrder !== undefined ? sortOrder : null}, ${createdAt || new Date().toISOString()}, ${updatedAt || new Date().toISOString()})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, description, ingredients, instructions, prepTime, cookTime, servings, tags, sourceUrl, sourcePlatform, thumbnail, channelName, isFavorite, sortOrder, updatedAt } = req.body;
      if (sourceUrl) {
        const existing = await sql`SELECT id FROM recipes WHERE user_id = ${userId} AND source_url = ${sourceUrl} AND id != ${id}`;
        if (existing.length > 0) {
          return res.status(409).json({ error: 'A recipe with this URL already exists.' });
        }
      }
      await sql`
        UPDATE recipes SET
          title = ${title},
          description = ${description || null},
          ingredients = ${JSON.stringify(ingredients || [])},
          instructions = ${JSON.stringify(instructions || [])},
          prep_time = ${prepTime || null},
          cook_time = ${cookTime || null},
          servings = ${servings || null},
          tags = ${tags || []},
          source_url = ${sourceUrl || null},
          source_platform = ${sourcePlatform || 'manual'},
          thumbnail = ${thumbnail || null},
          channel_name = ${channelName || null},
          is_favorite = ${isFavorite || false},
          sort_order = ${sortOrder !== undefined ? sortOrder : null},
          updated_at = ${updatedAt || new Date().toISOString()}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM recipes WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ RECIPE SHARING ============
async function handleRecipeShare(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipeId, email } = req.body;
  if (!recipeId || !email) {
    return res.status(400).json({ error: 'Recipe ID and email are required' });
  }

  // Find the target user
  const users = await sql`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`;
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  const targetUser = users[0];
  if (targetUser.id === userId) {
    return res.status(400).json({ error: 'Cannot share with yourself' });
  }

  // Fetch the recipe
  const recipes = await sql`
    SELECT id, title, description, ingredients, instructions,
      prep_time, cook_time, servings, tags, source_url, source_platform,
      thumbnail, channel_name
    FROM recipes WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  if (recipes.length === 0) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  const recipe = recipes[0];
  const newId = `shared_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Get sender name
  const senderRows = await sql`SELECT name FROM users WHERE id = ${userId}`;
  const senderName = senderRows.length > 0 ? senderRows[0].name as string : 'Someone';

  // Check if already shared with this user
  const existing = await sql`
    SELECT id FROM recipes
    WHERE shared_by_id = ${userId} AND shared_with_id = ${targetUser.id as string}
      AND title = ${recipe.title as string}
  `;
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Recipe already shared with this user' });
  }

  // Insert shared copy into recipes table
  await sql`
    INSERT INTO recipes (id, user_id, title, description, ingredients, instructions,
      prep_time, cook_time, servings, tags, source_url, source_platform,
      thumbnail, channel_name, is_favorite, sort_order,
      shared_by_id, shared_by_name, shared_with_id,
      created_at, updated_at)
    VALUES (
      ${newId}, ${userId}, ${recipe.title as string},
      ${recipe.description as string || null},
      ${typeof recipe.ingredients === 'string' ? recipe.ingredients as string : JSON.stringify(recipe.ingredients || [])},
      ${typeof recipe.instructions === 'string' ? recipe.instructions as string : JSON.stringify(recipe.instructions || [])},
      ${recipe.prep_time as number || null}, ${recipe.cook_time as number || null},
      ${recipe.servings as number || null},
      ${recipe.tags as string[] || []},
      ${recipe.source_url as string || null}, ${recipe.source_platform as string || 'manual'},
      ${recipe.thumbnail as string || null}, ${recipe.channel_name as string || null},
      false, null,
      ${userId}, ${senderName}, ${targetUser.id as string},
      ${now}, ${now}
    )
  `;

  return res.status(201).json({
    success: true,
    sharedWith: { name: targetUser.name, email: targetUser.email },
    message: `Recipe shared with ${targetUser.name}`,
  });
}

// ============ SHARED RECIPES (received) ============
async function handleSharedRecipes(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, title, description,
          ingredients, instructions,
          prep_time as "prepTime", cook_time as "cookTime", servings, tags,
          source_url as "sourceUrl", source_platform as "sourcePlatform",
          thumbnail, channel_name as "channelName",
          is_favorite as "isFavorite", sort_order as "sortOrder",
          created_at as "createdAt", updated_at as "updatedAt",
          shared_by_name as "sharedByName",
          created_at as "sharedAt"
        FROM recipes WHERE shared_with_id = ${userId}
        ORDER BY created_at DESC
      `;
      return res.status(200).json(rows.map((r: Record<string, unknown>) => ({
        ...r,
        ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients as string) : (r.ingredients || []),
        instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions as string) : (r.instructions || []),
      })));
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM recipes WHERE id = ${id as string} AND shared_with_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// YouTube video ID extractor
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    /youtube\.com\/shorts\/([^?\s]+)/,
    /youtube\.com\/embed\/([^?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function handleRecipeExtract(req: VercelRequest, res: VercelResponse, _userId: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, text } = req.body;

  // ── Text paste path ──────────────────────────────────────────────────────────
  if (text) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'AI parsing not configured on server.' });
    }
    let extracted: Record<string, unknown>;
    try {
      const client = new OpenAI({
        baseURL: 'https://models.github.ai/inference',
        apiKey: GITHUB_TOKEN,
      });
      const aiResponse = await client.chat.completions.create({
        model: 'openai/gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a recipe extraction assistant. Parse raw recipe text into structured data. Always respond with valid JSON only, no markdown.',
          },
          {
            role: 'user',
            content: `Parse the following text into a structured recipe. Return ONLY a valid JSON object with these exact fields:
- "title": string (recipe name)
- "description": string (1-2 sentence dish description)
- "ingredients": array of objects { "amount": string, "unit": string, "name": string }
- "instructions": array of strings (numbered steps as plain text)
- "prepTime": number (minutes, null if unknown)
- "cookTime": number (minutes, null if unknown)
- "servings": number (null if unknown)
- "tags": array of strings (e.g. ["Italian","pasta"])

If no recognisable recipe is present, return: {"error": "No recipe found"}

Recipe text:
${(text as string).substring(0, 6000)}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.1,
      });
      extracted = JSON.parse(aiResponse.choices[0].message.content ?? '{}') as Record<string, unknown>;
    } catch (aiError) {
      console.error('GitHub Models AI error:', aiError);
      return res.status(500).json({ error: 'AI parsing failed. Please try again.' });
    }
    if (extracted.error) {
      return res.status(422).json({ error: extracted.error as string });
    }
    return res.status(200).json({ ...extracted, sourcePlatform: 'manual' });
  }

  // ── URL path (YouTube) ───────────────────────────────────────────────────────
  if (!url) {
    return res.status(400).json({ error: 'Either url or text is required' });
  }

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  // Only YouTube supported for now
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Only YouTube URLs are supported. Paste a youtube.com or youtu.be link.' });
  }

  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'YouTube API key not configured on server.' });
  }

  // Fetch video details from YouTube Data API v3
  const ytResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet`
  );
  if (!ytResponse.ok) {
    return res.status(502).json({ error: 'Failed to fetch YouTube video data. Check your API key.' });
  }
  const ytData = await ytResponse.json() as { items?: Array<{ snippet: { title: string; description: string; channelTitle: string; thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } } }> };
  if (!ytData.items || ytData.items.length === 0) {
    return res.status(404).json({ error: 'YouTube video not found or is private.' });
  }

  const snippet = ytData.items[0].snippet;
  const videoTitle = snippet.title;
  const description = snippet.description || '';
  const channelName = snippet.channelTitle;
  const thumbnail =
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url || '';

  const baseResult = {
    title: videoTitle,
    channelName,
    thumbnail,
    sourceUrl: url,
    sourcePlatform: 'youtube' as const,
    description: description.substring(0, 400),
    ingredients: [] as unknown[],
    instructions: [] as string[],
    tags: [] as string[],
  };

  // If no GitHub token, return raw YouTube metadata only
  if (!GITHUB_TOKEN) {
    return res.status(200).json(baseResult);
  }

  // Use GitHub Models (gpt-4.1-mini) to extract recipe from description
  let extracted: Record<string, unknown>;
  try {
    const client = new OpenAI({
      baseURL: 'https://models.github.ai/inference',
      apiKey: GITHUB_TOKEN,
    });

    const aiResponse = await client.chat.completions.create({
      model: 'openai/gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a recipe extraction assistant. Extract structured recipe data from YouTube video info. Always respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Extract the recipe from this YouTube video. Return ONLY a valid JSON object with these exact fields:
- "title": string (clean recipe name; simplify if needed)
- "description": string (1-2 sentence dish description)
- "ingredients": array of objects { "amount": string, "unit": string, "name": string }
- "instructions": array of strings (numbered steps as plain text)
- "prepTime": number (minutes, estimate if not stated, null if unknown)
- "cookTime": number (minutes, estimate if not stated, null if unknown)
- "servings": number (estimate if not stated, null if unknown)
- "tags": array of strings (cuisine type, dietary info, e.g. ["Italian","pasta","vegetarian"])

If no recipe is found in the description, return: {"error": "No recipe found in description"}

Video Title: ${videoTitle}
Video Description (first 3000 chars):
${description.substring(0, 3000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.1,
    });

    extracted = JSON.parse(aiResponse.choices[0].message.content ?? '{}') as Record<string, unknown>;
  } catch (aiError) {
    console.error('GitHub Models AI error:', aiError);
    return res.status(200).json(baseResult);
  }

  if (extracted.error) {
    return res.status(422).json({
      error: extracted.error as string,
      title: videoTitle,
      channelName,
      thumbnail,
      sourceUrl: url,
      sourcePlatform: 'youtube',
    });
  }

  return res.status(200).json({
    ...extracted,
    title: (extracted.title as string) || videoTitle,
    channelName,
    thumbnail,
    sourceUrl: url,
    sourcePlatform: 'youtube',
  });
}