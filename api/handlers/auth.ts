import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { Resend } from 'resend';
import {
  sql,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
  checkRateLimit,
} from '../db.js';
import { validateEmail, validatePassword, validateName } from '../validators.js';

// Lazily initialised so the module still loads if RESEND_API_KEY is absent
// (dev / CI environments). Always present in production via Vercel env vars.
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY environment variable is not set');
  return new Resend(key);
}

const APP_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'Almost Adult <noreply@almostadult.app>';
const APP_NAME = 'Almost Adult';

// Generates a cryptographically random 6-digit numeric code.
function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString();
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

// ── Rate limiting helpers ───────────────────────────────────────────────────

// Prefer x-real-ip (set by Vercel's edge to the actual client IP).
// Fall back to the last entry in x-forwarded-for, which is least spoofable.
function getClientIp(req: VercelRequest): string {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    const parts = forwarded.split(',');
    return parts[parts.length - 1].trim();
  }
  return 'unknown';
}

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

  // 10 attempts per 15 minutes per IP
  if (await checkRateLimit(getClientIp(req), 'login', 10, 15 * 60)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body ?? {};
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ error: emailErr });
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const users = await sql`
    SELECT id, email, name, password_hash, email_verified FROM users WHERE email = ${(email as string).toLowerCase()}
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
    user: { id: userId, email: user.email, name: user.name, emailVerified: user.email_verified as boolean },
    accessToken: generateAccessToken(userId),
    refreshToken,
  });
}

export async function handleSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 5 signups per hour per IP
  if (await checkRateLimit(getClientIp(req), 'signup', 5, 60 * 60)) {
    return res.status(429).json({ error: 'Too many signup attempts. Try again in an hour.' });
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

  // Generate a 6-digit verification code and send the welcome/verification email.
  // We do this after seeding so the user lands in a working state even if the
  // email send fails.
  const verificationCode = generateVerificationCode();
  const codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await sql`
    INSERT INTO email_verification_tokens (token, user_id, expires_at)
    VALUES (${verificationCode}, ${userId}, ${codeExpiresAt})
  `;
  try {
    const resend = getResend();
    await resend.emails.send({
      from: APP_FROM_ADDRESS,
      to: lowered,
      subject: `Verify your ${APP_NAME} email`,
      html: buildVerificationEmailHtml(verificationCode, (name as string).trim()),
      text: buildVerificationEmailText(verificationCode),
    });
  } catch (emailErr) {
    console.error('[signup] Failed to send verification email:', emailErr);
  }

  const refreshToken = generateRefreshToken(userId);
  setRefreshCookie(res, refreshToken);
  return res.status(201).json({
    user: { id: userId, email: lowered, name: (name as string).trim(), emailVerified: false },
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
  const users = await sql`SELECT id, email, name, email_verified FROM users WHERE id = ${userId}`;
  if (users.length === 0) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'User not found' });
  }
  const u = users[0];
  const newRefreshToken = generateRefreshToken(userId);
  setRefreshCookie(res, newRefreshToken);
  return res.status(200).json({
    user: { id: u.id, email: u.email, name: u.name, emailVerified: u.email_verified as boolean },
    accessToken: generateAccessToken(userId),
    refreshToken: newRefreshToken,
  });
}

export async function handleLogout(_req: VercelRequest, res: VercelResponse) {
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

  const users = await sql`SELECT id, email, name, email_verified FROM users WHERE id = ${userId}`;
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const u = users[0];
  return res.status(200).json({ user: { id: u.id, email: u.email, name: u.name, emailVerified: u.email_verified as boolean } });
}

/**
 * POST /api/auth/forgot-password
 * Generates a password-reset token and emails it to the user.
 *
 * Security notes:
 * - Always returns 200 regardless of whether the email exists (prevents user enumeration).
 * - Token is a 32-byte cryptographically random hex string, expires in 1 hour.
 * - Only one active token per user at a time (old tokens are deleted on request).
 * - Token is NEVER returned in the response body in production.
 */
export async function handleForgotPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 5 requests per hour per IP
  if (await checkRateLimit(getClientIp(req), 'forgot-password', 5, 60 * 60)) {
    return res.status(429).json({ error: 'Too many requests. Try again in an hour.' });
  }

  const { email } = req.body ?? {};
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ error: emailErr });

  const normalizedEmail = (email as string).trim().toLowerCase();

  // Look up user — return the same success response regardless to prevent
  // user enumeration. Do the DB + email work only if the user actually exists.
  const users = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
  if (users.length === 0) {
    return res.status(200).json({ success: true });
  }

  const userId = users[0].id as string;
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate any existing tokens for this user, then insert the new one.
  await sql`DELETE FROM password_reset_tokens WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO password_reset_tokens (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt})
  `;

  // Send the reset code via email. Any error here is logged server-side but
  // we still return 200 to the client — the user can request a new code if
  // the email doesn't arrive.
  try {
    const resend = getResend();
    await resend.emails.send({
      from: APP_FROM_ADDRESS,
      to: normalizedEmail,
      subject: `Your ${APP_NAME} password reset code`,
      html: buildResetEmailHtml(token),
      text: buildResetEmailText(token),
    });
  } catch (emailErr) {
    console.error('[forgot-password] Failed to send reset email:', emailErr);
  }

  return res.status(200).json({ success: true });
}

function buildResetEmailText(token: string): string {
  return [
    `Your ${APP_NAME} password reset code is:`,
    '',
    token,
    '',
    'Enter this code in the app to set a new password.',
    'It expires in 1 hour. If you did not request a reset, ignore this email.',
  ].join('\n');
}

function buildResetEmailHtml(token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reset your ${APP_NAME} password</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#18181b;padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${APP_NAME}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Reset your password</p>
              <p style="margin:0 0 32px;font-size:15px;color:#71717a;">Enter the code below in the app to set a new password. It expires in <strong>1 hour</strong>.</p>
              <div style="background:#f4f4f5;border-radius:8px;padding:20px 24px;text-align:center;letter-spacing:3px;font-size:28px;font-weight:700;font-family:monospace;color:#18181b;">${token}</div>
              <p style="margin:32px 0 0;font-size:13px;color:#a1a1aa;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildVerificationEmailText(code: string): string {
  return [
    `Your ${APP_NAME} verification code`,
    '',
    code,
    '',
    'Enter this code in the app to verify your email address.',
    'It expires in 24 hours. If you did not create an account, you can ignore this email.',
  ].join('\n');
}

function buildVerificationEmailHtml(code: string, name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Verify your ${APP_NAME} email</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#18181b;padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${APP_NAME}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Hi ${name}, verify your email</p>
              <p style="margin:0 0 32px;font-size:15px;color:#71717a;">Enter the code below in the app to confirm your email address. It expires in <strong>24 hours</strong>.</p>
              <div style="background:#f4f4f5;border-radius:8px;padding:20px 24px;text-align:center;letter-spacing:6px;font-size:36px;font-weight:700;font-family:monospace;color:#18181b;">${code}</div>
              <p style="margin:32px 0 0;font-size:13px;color:#a1a1aa;">If you didn't create a ${APP_NAME} account, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * POST /api/auth/verify-email
 * Verifies the user's email using a 6-digit code. Requires a valid access token.
 */
export async function handleVerifyEmail(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body ?? {};
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Verification code is required' });

  const trimmed = code.trim();

  // Guard: already verified?
  const userRows = await sql`SELECT email_verified FROM users WHERE id = ${userId}`;
  if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
  if (userRows[0].email_verified) return res.status(400).json({ error: 'Email is already verified' });

  // Look up a valid, unused, unexpired token that belongs to this user.
  const tokenRows = await sql`
    SELECT token FROM email_verification_tokens
    WHERE token = ${trimmed} AND user_id = ${userId} AND used = FALSE AND expires_at > NOW()
  `;
  if (tokenRows.length === 0) {
    return res.status(400).json({ error: 'Invalid or expired verification code. Request a new one.' });
  }

  // Mark the user verified and consume the token in parallel.
  await Promise.all([
    sql`UPDATE users SET email_verified = TRUE WHERE id = ${userId}`,
    sql`UPDATE email_verification_tokens SET used = TRUE WHERE token = ${trimmed}`,
  ]);

  return res.status(200).json({ success: true });
}

/**
 * POST /api/auth/resend-verification
 * Generates a new verification code and sends it. Rate-limited to once per 60 s.
 */
export async function handleResendVerification(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userRows = await sql`SELECT email, name, email_verified FROM users WHERE id = ${userId}`;
  if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
  if (userRows[0].email_verified) return res.status(400).json({ error: 'Email is already verified' });

  // Rate-limit: refuse if a token was created within the last 60 seconds.
  const recentRows = await sql`
    SELECT created_at FROM email_verification_tokens
    WHERE user_id = ${userId} AND used = FALSE
      AND created_at > NOW() - INTERVAL '60 seconds'
  `;
  if (recentRows.length > 0) {
    return res.status(429).json({ error: 'Please wait 60 seconds before requesting a new code.' });
  }

  // Delete all old tokens for this user, then insert a fresh one.
  await sql`DELETE FROM email_verification_tokens WHERE user_id = ${userId}`;
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await sql`INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES (${code}, ${userId}, ${expiresAt})`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: APP_FROM_ADDRESS,
      to: userRows[0].email as string,
      subject: `Verify your ${APP_NAME} email`,
      html: buildVerificationEmailHtml(code, userRows[0].name as string),
      text: buildVerificationEmailText(code),
    });
  } catch (emailErr) {
    console.error('[resend-verification] Failed to send email:', emailErr);
  }

  return res.status(200).json({ success: true });
}

/**
 * POST /api/auth/reset-password
 * Verifies a reset token and updates the user's password.
 */
export async function handleResetPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { token, password } = req.body ?? {};
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Invalid token' });

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const rows = await sql`
    SELECT user_id FROM password_reset_tokens
    WHERE token = ${token} AND used = FALSE AND expires_at > NOW()
  `;
  if (rows.length === 0) {
    return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
  }

  const userId = rows[0].user_id as string;
  const hash = await bcrypt.hash(password, 10);

  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
  await sql`UPDATE password_reset_tokens SET used = TRUE WHERE token = ${token}`;

  return res.status(200).json({ success: true });
}

/**
 * DELETE /api/auth/account
 * Deletes the authenticated user's account and all associated data.
 * Cascades via foreign-key ON DELETE CASCADE on all user-owned tables.
 */
export async function handleDeleteAccount(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Delete the user row — ON DELETE CASCADE handles all child rows.
  await sql`DELETE FROM users WHERE id = ${userId}`;

  // Clear the refresh-token cookie.
  res.setHeader('Set-Cookie', buildRefreshCookie('', 0));
  return res.status(200).json({ success: true });
}
