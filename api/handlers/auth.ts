import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import {
  sql,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
} from '../db.js';
import { validateEmail, validatePassword, validateName } from '../validators.js';

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

// In production we serve the API from the same origin as the SPA (Vercel),
// so SameSite=Lax + Secure is correct. In development the Vite dev server
// proxies /api to the deployed backend; cookies still flow on the proxied
// response, but Secure can't be used over plain http://localhost. Gate it
// on NODE_ENV.
function buildRefreshCookie(token: string, maxAgeSeconds: number): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${REFRESH_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function setRefreshCookie(res: VercelResponse, token: string) {
  res.setHeader('Set-Cookie', buildRefreshCookie(token, REFRESH_COOKIE_MAX_AGE_SECONDS));
}

function clearRefreshCookie(res: VercelResponse) {
  // Max-Age=0 expires the cookie immediately.
  res.setHeader('Set-Cookie', buildRefreshCookie('', 0));
}

function readRefreshCookie(req: VercelRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const cookies = header.split(';');
  for (const c of cookies) {
    const [rawName, ...rest] = c.split('=');
    if (rawName?.trim() === REFRESH_COOKIE_NAME) {
      return rest.join('=').trim() || null;
    }
  }
  return null;
}

export async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body ?? {};
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ error: emailErr });
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const users = await sql`
    SELECT id, email, name, password_hash FROM users WHERE email = ${(email as string).toLowerCase()}
  `;

  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = users[0];
  const validPassword = await bcrypt.compare(password, user.password_hash as string);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const userId = user.id as string;
  const refreshToken = generateRefreshToken(userId);
  setRefreshCookie(res, refreshToken);
  return res.status(200).json({
    user: { id: userId, email: user.email, name: user.name },
    accessToken: generateAccessToken(userId),
    // Also returned in body so native clients can store it in secure storage.
    // Web clients ignore this field and rely on the httpOnly cookie.
    refreshToken,
  });
}

export async function handleSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, password } = req.body ?? {};
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ error: emailErr });
  const nameErr = validateName(name);
  if (nameErr) return res.status(400).json({ error: nameErr });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const lowered = (email as string).toLowerCase();
  const existingUsers = await sql`SELECT id FROM users WHERE email = ${lowered}`;
  if (existingUsers.length > 0) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  await sql`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${userId}, ${lowered}, ${(name as string).trim()}, ${passwordHash})
  `;

  // Seed defaults once on signup so GET handlers don't need to re-seed every call.
  await seedDefaultsForUser(userId);

  const refreshToken = generateRefreshToken(userId);
  setRefreshCookie(res, refreshToken);
  return res.status(201).json({
    user: { id: userId, email: lowered, name: (name as string).trim() },
    accessToken: generateAccessToken(userId),
    refreshToken,
  });
}

// Issue a new short-lived access token from a valid refresh cookie OR
// a Bearer token (for native clients that can't use httpOnly cookies).
// Rotates the refresh token on every call to extend the active session.
export async function handleRefresh(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Native sends: Authorization: Bearer <refreshToken>
  // Web sends: the httpOnly cookie (credentials: include)
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const refresh = bearerToken ?? readRefreshCookie(req);
  if (!refresh) {
    return res.status(401).json({ error: 'No refresh token' });
  }
  const userId = verifyRefreshToken(refresh);
  if (!userId) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  // Confirm the user still exists.
  const users = await sql`SELECT id, email, name FROM users WHERE id = ${userId}`;
  if (users.length === 0) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'User not found' });
  }
  const newRefreshToken = generateRefreshToken(userId);
  setRefreshCookie(res, newRefreshToken);
  return res.status(200).json({
    user: users[0],
    accessToken: generateAccessToken(userId),
    // Return rotated token in body so native clients can update secure storage.
    refreshToken: newRefreshToken,
  });
}

export async function handleLogout(req: VercelRequest, res: VercelResponse) {
  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
}

async function seedDefaultsForUser(userId: string) {
  const ts = Date.now();
  // Body parts
  for (let i = 0; i < DEFAULT_BODY_PARTS.length; i++) {
    const bp = DEFAULT_BODY_PARTS[i];
    await sql`
      INSERT INTO body_parts (id, user_id, name, color, sort_order)
      VALUES (${`bp_${ts}_${i}`}, ${userId}, ${bp.name}, ${bp.color}, ${i})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  // Shopping stores
  for (let i = 0; i < DEFAULT_SHOPPING_STORES.length; i++) {
    const s = DEFAULT_SHOPPING_STORES[i];
    await sql`
      INSERT INTO shopping_stores (id, user_id, name, color, sort_order)
      VALUES (${`store_${ts}_${i}`}, ${userId}, ${s.name}, ${s.color}, ${i})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  // Todo categories
  for (let i = 0; i < DEFAULT_TODO_CATEGORIES.length; i++) {
    const c = DEFAULT_TODO_CATEGORIES[i];
    await sql`
      INSERT INTO todo_categories (id, user_id, name, color, sort_order)
      VALUES (${`cat_${ts}_${i}`}, ${userId}, ${c.name}, ${c.color}, ${i})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

export async function handleMe(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const users = await sql`SELECT id, email, name FROM users WHERE id = ${userId}`;
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ user: users[0] });
}
