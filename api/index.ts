import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import webpush from 'web-push';
import { sql, getUserIdFromRequest, generateToken, initDb } from './db.js';

// Configure web-push with VAPID keys (must be set in environment variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@almostadult.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

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
      case 'workouts':
        return handleWorkouts(req, res, userId);
      case 'periods':
        return handlePeriods(req, res, userId);
      case 'periods/settings':
        return handlePeriodSettings(req, res, userId);
      case 'settings':
        return handleUserSettings(req, res, userId);
      case 'push-subscription':
        return handlePushSubscription(req, res, userId);
      case 'notifications/test':
        return handleTestNotification(req, res, userId);
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
          t.backlog_month as "backlogMonth",
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
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category, originalDate, overdue, sortOrder, assignedToUserId, backlogMonth } = req.body;
      await sql`
        INSERT INTO todos (id, user_id, title, completed, date, time, priority, recurrence, completed_dates, excluded_dates, category, original_date, overdue, sort_order, assigned_to_user_id, backlog_month)
        VALUES (${id}, ${userId}, ${title}, ${completed || false}, ${date}, ${time || null}, ${priority || 'medium'}, ${recurrence || 'none'}, ${completedDates || []}, ${excludedDates || []}, ${category || null}, ${originalDate || null}, ${overdue || false}, ${sortOrder !== undefined ? sortOrder : null}, ${assignedToUserId || null}, ${backlogMonth || null})
      `;
      
      // Send notification if task is assigned to someone else
      if (assignedToUserId && assignedToUserId !== userId) {
        const [owner] = await sql`SELECT name FROM users WHERE id = ${userId}`;
        sendNotificationToUser(assignedToUserId, {
          title: '📋 New Task Assigned',
          body: `${owner?.name || 'Someone'} assigned you: "${title}"`,
          tag: `task-${id}`,
          url: '/'
        });
      }
      
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category, originalDate, overdue, sortOrder, assignedToUserId, backlogMonth } = req.body;
      await sql`
        UPDATE todos SET title = ${title}, completed = ${completed}, 
          date = ${date}, time = ${time || null}, priority = ${priority}, recurrence = ${recurrence},
          completed_dates = ${completedDates || []}, excluded_dates = ${excludedDates || []}, category = ${category || null},
          original_date = ${originalDate || null}, overdue = ${overdue || false}, sort_order = ${sortOrder !== undefined ? sortOrder : null},
          assigned_to_user_id = ${assignedToUserId !== undefined ? assignedToUserId : null},
          backlog_month = ${backlogMonth !== undefined ? backlogMonth : null}
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

      // Notify the other user about the new connection
      const [connectingUser] = await sql`SELECT name FROM users WHERE id = ${userId}`;
      sendNotificationToUser(targetUser.id, {
        title: '👋 New Connection',
        body: `${connectingUser?.name || 'Someone'} added you as a connection`,
        tag: `connection-${userId}`,
        url: '/settings'
      });

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
          CASE WHEN si.user_id = ${userId} THEN true ELSE false END as "isOwn"
        FROM shopping_items si
        JOIN users u ON si.user_id = u.id
        LEFT JOIN shopping_stores ss ON si.store_id = ss.id
        WHERE si.user_id = ${userId}
           OR si.user_id IN (
             SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
           )
        ORDER BY si.completed ASC, si.created_at DESC
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
      const [currentItem] = await sql`SELECT si.name, si.completed, si.user_id as "ownerId", u.name as "ownerName" 
        FROM shopping_items si 
        JOIN users u ON si.user_id = u.id 
        WHERE si.id = ${id}`;
      
      await sql`
        UPDATE shopping_items SET name = ${name}, quantity = ${quantity}, store_id = ${storeId}, completed = ${completed}, sort_order = ${sortOrder !== undefined ? sortOrder : null}
        WHERE id = ${id} AND (user_id = ${userId} OR user_id IN (
          SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
        ))
      `;
      
      if (currentItem && currentItem.completed !== completed) {
        await sql`
          INSERT INTO shopping_audit (id, user_id, action, item_name, details)
          VALUES (${Date.now().toString()}, ${userId}, ${completed ? 'completed' : 'uncompleted'}, ${name}, NULL)
        `;
        
        // Notify item owner if someone else completed their item
        if (completed && currentItem.ownerId && currentItem.ownerId !== userId) {
          const [completedBy] = await sql`SELECT name FROM users WHERE id = ${userId}`;
          sendNotificationToUser(currentItem.ownerId, {
            title: '✅ Item Completed',
            body: `${completedBy?.name || 'Someone'} marked "${name}" as done`,
            tag: `shopping-${id}`,
            url: '/shopping'
          });
        }
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
      // Check if user has their own stores, create defaults if not
      let ownStores = await sql`
        SELECT id, name, color, sort_order as "sortOrder"
        FROM shopping_stores WHERE user_id = ${userId} ORDER BY sort_order, created_at
      `;
      if (ownStores.length === 0) {
        for (let i = 0; i < DEFAULT_SHOPPING_STORES.length; i++) {
          const store = DEFAULT_SHOPPING_STORES[i];
          await sql`
            INSERT INTO shopping_stores (id, user_id, name, color, sort_order)
            VALUES (${`store_${Date.now()}_${i}`}, ${userId}, ${store.name}, ${store.color}, ${i})
          `;
        }
        ownStores = await sql`
          SELECT id, name, color, sort_order as "sortOrder"
          FROM shopping_stores WHERE user_id = ${userId} ORDER BY sort_order, created_at
        `;
      }
      // Also get stores from shared users, deduplicated by name
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
      // Check if user has their own categories, create defaults if not
      let ownCategories = await sql`
        SELECT id, name, color, sort_order as "sortOrder"
        FROM todo_categories WHERE user_id = ${userId} ORDER BY sort_order, created_at
      `;
      if (ownCategories.length === 0) {
        for (let i = 0; i < DEFAULT_TODO_CATEGORIES.length; i++) {
          const category = DEFAULT_TODO_CATEGORIES[i];
          await sql`
            INSERT INTO todo_categories (id, user_id, name, color, sort_order)
            VALUES (${`category_${Date.now()}_${i}`}, ${userId}, ${category.name}, ${category.color}, ${i})
          `;
        }
        ownCategories = await sql`
          SELECT id, name, color, sort_order as "sortOrder"
          FROM todo_categories WHERE user_id = ${userId} ORDER BY sort_order, created_at
        `;
      }
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
        SELECT id, name, body_part as "bodyPart", sets, reps, weight
        FROM exercises WHERE user_id = ${userId} ORDER BY body_part, name
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

// ============ PUSH SUBSCRIPTIONS ============
async function handlePushSubscription(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'POST': {
      const { subscription } = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Invalid subscription' });
      }
      
      const { endpoint, keys } = subscription;
      const id = `push_${Date.now()}`;
      
      // Delete any existing subscriptions for this endpoint
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
      
      // Insert new subscription
      await sql`
        INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
        VALUES (${id}, ${userId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      `;
      
      return res.status(201).json({ success: true });
    }
    case 'DELETE': {
      // Delete all subscriptions for this user
      await sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============ TEST NOTIFICATION ============
async function handleTestNotification(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get user's subscriptions
  const subscriptions = await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  `;
  
  if (subscriptions.length === 0) {
    return res.status(404).json({ error: 'No push subscriptions found' });
  }
  
  const payload = JSON.stringify({
    title: 'Almost Adult 🎉',
    body: 'Notifications are working! You\'ll be notified about reminders and updates.',
    icon: '/logo.png',
    tag: 'test',
    data: { url: '/' }
  });
  
  const results = [];
  for (const sub of subscriptions) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        } as any,
        payload
      );
      results.push({ endpoint: sub.endpoint, success: true });
    } catch (error: unknown) {
      console.error('Push notification failed:', error);
      // If subscription is invalid, remove it
      if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
      }
      results.push({ endpoint: sub.endpoint, success: false, error: String(error) });
    }
  }
  
  return res.status(200).json({ results });
}

// ============ SEND NOTIFICATION HELPER ============
async function sendNotificationToUser(userId: string, notification: { title: string; body: string; tag?: string; url?: string }) {
  const subscriptions = await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  `;
  
  if (subscriptions.length === 0) return;
  
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: '/logo.png',
    tag: notification.tag || 'notification',
    data: { url: notification.url || '/' }
  });
  
  for (const sub of subscriptions) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        } as any,
        payload
      );
    } catch (error: unknown) {
      console.error('Push notification failed:', error);
      // If subscription is invalid (410 Gone), remove it
      if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
      }
    }
  }
}