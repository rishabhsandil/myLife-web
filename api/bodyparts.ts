import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getUserIdFromRequest } from './db.js';

// Default body parts for new users
const DEFAULT_BODY_PARTS = [
  { name: 'Chest/Tri', color: '#EF4444' },
  { name: 'Back/Bi', color: '#6366F1' },
  { name: 'Shoulders', color: '#F59E0B' },
  { name: 'Legs/Core', color: '#EC4899' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        let rows = await sql`
          SELECT id, name, color, sort_order as "sortOrder"
          FROM body_parts 
          WHERE user_id = ${userId}
          ORDER BY sort_order, created_at
        `;
        
        // If no body parts exist, create defaults for this user
        if (rows.length === 0) {
          for (let i = 0; i < DEFAULT_BODY_PARTS.length; i++) {
            const bp = DEFAULT_BODY_PARTS[i];
            const id = `bp_${Date.now()}_${i}`;
            await sql`
              INSERT INTO body_parts (id, user_id, name, color, sort_order)
              VALUES (${id}, ${userId}, ${bp.name}, ${bp.color}, ${i})
            `;
          }
          // Fetch the newly created body parts
          rows = await sql`
            SELECT id, name, color, sort_order as "sortOrder"
            FROM body_parts 
            WHERE user_id = ${userId}
            ORDER BY sort_order, created_at
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
          UPDATE body_parts 
          SET name = ${name}, color = ${color}, sort_order = ${sortOrder || 0}
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (id) {
          await sql`DELETE FROM body_parts WHERE id = ${id as string} AND user_id = ${userId}`;
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Body parts API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
