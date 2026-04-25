import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db.js';

const DEFAULT_MODULES = ['todos', 'shopping', 'workout', 'notes'];

export async function handleUserSettings(req: VercelRequest, res: VercelResponse, userId: string) {
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
