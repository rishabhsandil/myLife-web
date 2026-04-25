/**
 * Centralized validators for the API. Keep policy aligned with
 * `src/utils/validation.ts` on the client.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 8;

export function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || email.length === 0) return 'Email is required';
  if (email.length > 254) return 'Email is too long';
  if (!EMAIL_REGEX.test(email)) return 'Invalid email format';
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

export function validateName(name: unknown): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) return 'Name is required';
  if (name.length > 100) return 'Name is too long';
  return null;
}
