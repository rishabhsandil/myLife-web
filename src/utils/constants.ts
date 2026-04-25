/**
 * Shared UI/timing/validation constants.
 *
 * Magic numbers used to live inline (swipe thresholds, etc.). They live here
 * so behaviour stays consistent across pages.
 */

// ── Swipe-to-delete (used on list/card items across pages) ────────────────────
export const SWIPE_DELETE_THRESHOLD_PX = -70;
export const SWIPE_MAX_OFFSET_PX = -100;
export const SWIPE_RESET_DELAY_MS = 300;

// ── Long-running API calls ────────────────────────────────────────────────────
export const DEFAULT_API_TIMEOUT_MS = 15_000;
export const AI_API_TIMEOUT_MS = 30_000;

// ── Editor / content ──────────────────────────────────────────────────────────
/** Max base64 image size accepted by the Tiptap editor (bytes, ~2 MB). */
export const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;

// ── Auth / password (mirror of server policy) ────────────────────────────────
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULES_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.';

// ── Splash ────────────────────────────────────────────────────────────────────
export const SPLASH_MIN_DURATION_MS = 2000;
