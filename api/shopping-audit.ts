import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getUserIdFromRequest } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      // Get audit history for user and their share partners
      const rows = await sql`
        SELECT 
          sa.id, sa.action, sa.item_name as "itemName", sa.details,
          sa.created_at as "createdAt",
          u.name as "userName"
        FROM shopping_audit sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.user_id = ${userId}
           OR sa.user_id IN (
             SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
             UNION
             SELECT shared_with_id FROM shopping_shares WHERE owner_id = ${userId}
           )
        ORDER BY sa.created_at DESC
        LIMIT 50
      `;
      return res.status(200).json(rows);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Shopping audit API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
