/**
 * Push-notification delivery via the Expo Push Service.
 *
 * The native app registers an Expo push token per device (see push handler);
 * cross-user events (task assignment, shopping changes, recipe shares,
 * connection add/remove) call `sendPushToUsers` to fan out to the recipients'
 * devices. Delivery is best-effort: failures are logged, never thrown, so a
 * push problem can never break the user action that triggered it.
 */
import { sql } from './db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_PREFIX = 'ExponentPushToken';
const EXPO_BATCH_SIZE = 100; // Expo accepts up to 100 messages per request.

export interface PushMessage {
  title: string;
  body: string;
  /** Routing hints for the client tap handler, e.g. { type: 'assignment' }. */
  data?: Record<string, unknown>;
}

/** Upsert a device's Expo push token, re-pointing it to `userId` if it moved. */
export async function savePushToken(
  userId: string,
  token: string,
  platform: string | null,
): Promise<void> {
  await sql`
    INSERT INTO push_tokens (token, user_id, platform)
    VALUES (${token}, ${userId}, ${platform})
    ON CONFLICT (token)
    DO UPDATE SET user_id = ${userId}, platform = ${platform}, created_at = NOW()
  `;
}

/** Remove a device token (e.g. on logout). */
export async function removePushToken(token: string): Promise<void> {
  await sql`DELETE FROM push_tokens WHERE token = ${token}`;
}

/** Notify `recipientId` that `actorId` added or removed them as a connection. */
export async function notifyConnectionChange(actorId: string, recipientId: string, added: boolean) {
  const [actor] = await sql`SELECT name FROM users WHERE id = ${actorId}`;
  const name = (actor?.name as string) ?? 'Someone';
  await sendPushToUsers([recipientId], {
    title: added ? 'New connection' : 'Connection removed',
    body: added ? `${name} connected with you` : `${name} removed you as a connection`,
    data: { type: added ? 'connection-added' : 'connection-removed' },
  });
}

/** All user IDs connected to `userId` (the audience for that user's shared data). */
export async function getConnectedUserIds(userId: string): Promise<string[]> {
  const rows = await sql`
    SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
  `;
  return rows.map((r) => r.connected_user_id as string);
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Send `message` to every registered device of the given users. Never throws.
 * Prunes tokens that Expo reports as `DeviceNotRegistered` (app uninstalled).
 */
export async function sendPushToUsers(
  userIds: string[],
  message: PushMessage,
): Promise<void> {
  try {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (ids.length === 0) return;

    const rows = await sql`
      SELECT token FROM push_tokens WHERE user_id = ANY(${ids}::text[])
    `;
    const tokens = rows
      .map((r) => r.token as string)
      .filter((t) => typeof t === 'string' && t.startsWith(EXPO_TOKEN_PREFIX));
    if (tokens.length === 0) return;

    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const batch = tokens.slice(i, i + EXPO_BATCH_SIZE);
      const payload = batch.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: 'default',
      }));

      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        console.error('Expo push request failed:', resp.status);
        continue;
      }

      const json = (await resp.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = json?.data ?? [];
      const dead = batch.filter(
        (_, idx) =>
          tickets[idx]?.status === 'error' &&
          tickets[idx]?.details?.error === 'DeviceNotRegistered',
      );
      if (dead.length > 0) {
        await sql`DELETE FROM push_tokens WHERE token = ANY(${dead}::text[])`;
      }
    }
  } catch (err) {
    console.error('sendPushToUsers error:', err);
  }
}
