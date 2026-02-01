import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getUserIdFromRequest } from './db';

// Default enabled modules
const DEFAULT_MODULES = ['todos', 'shopping', 'workout', 'period'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET - Fetch user settings
  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT enabled_modules FROM user_settings WHERE user_id = ${userId}
      `;
      
      if (result.length === 0) {
        return res.json({ enabledModules: DEFAULT_MODULES });
      }
      
      return res.json({
        enabledModules: result[0].enabled_modules || DEFAULT_MODULES,
      });
    } catch (error) {
      console.error('Error fetching user settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  // POST - Save user settings
  if (req.method === 'POST') {
    try {
      const { enabledModules } = req.body;
      
      // Validate enabledModules
      const validModules = ['todos', 'shopping', 'workout', 'period'];
      const filteredModules = (enabledModules || []).filter((m: string) => validModules.includes(m));
      
      // Ensure at least one module is enabled
      if (filteredModules.length === 0) {
        return res.status(400).json({ error: 'At least one module must be enabled' });
      }
      
      await sql`
        INSERT INTO user_settings (user_id, enabled_modules, updated_at)
        VALUES (${userId}, ${filteredModules}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          enabled_modules = ${filteredModules},
          updated_at = NOW()
      `;
      
      return res.json({ success: true, enabledModules: filteredModules });
    } catch (error) {
      console.error('Error saving user settings:', error);
      return res.status(500).json({ error: 'Failed to save settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
