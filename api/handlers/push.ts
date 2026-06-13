import type { VercelRequest, VercelResponse } from '@vercel/node';
import { savePushToken, removePushToken } from '../push.js';

/**
 * POST   /api/push/token  { token, platform }  — register/refresh this device.
 * DELETE /api/push/token?token=...             — unregister (e.g. on logout).
 */
export async function handlePushToken(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method === 'POST') {
    const { token, platform } = req.body ?? {};
    if (typeof token !== 'string' || !token.startsWith('ExponentPushToken')) {
      return res.status(400).json({ error: 'Valid Expo push token required' });
    }
    await savePushToken(userId, token, typeof platform === 'string' ? platform : null);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token query parameter required' });
    }
    await removePushToken(token);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
