import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getUserIdFromRequest } from './db.js';

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
        // Get my items + items from people who share with me
        const rows = await sql`
          SELECT 
            si.id, si.name, si.quantity, si.category, si.completed, 
            si.created_at as "createdAt", si.user_id as "ownerId",
            u.name as "ownerName",
            CASE WHEN si.user_id = ${userId} THEN true ELSE false END as "isOwn"
          FROM shopping_items si
          JOIN users u ON si.user_id = u.id
          WHERE si.user_id = ${userId}
             OR si.user_id IN (
               SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
             )
          ORDER BY si.completed ASC, si.created_at DESC
        `;
        return res.status(200).json(rows);
      }

      case 'POST': {
        const { id, name, quantity, category, completed } = req.body;
        await sql`
          INSERT INTO shopping_items (id, user_id, name, quantity, category, completed)
          VALUES (${id}, ${userId}, ${name}, ${quantity || 1}, ${category || 'freshco'}, ${completed || false})
        `;
        return res.status(201).json({ success: true });
      }

      case 'PUT': {
        const { id, name, quantity, category, completed } = req.body;
        // Can update own items OR items shared with me
        await sql`
          UPDATE shopping_items 
          SET name = ${name}, quantity = ${quantity}, category = ${category}, completed = ${completed}
          WHERE id = ${id} 
            AND (user_id = ${userId} OR user_id IN (
              SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
            ))
        `;
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        const { id, clearCompleted } = req.query;
        if (clearCompleted === 'true') {
          // Clear my completed items + completed items from shared lists
          await sql`
            DELETE FROM shopping_items 
            WHERE completed = true 
              AND (user_id = ${userId} OR user_id IN (
                SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
              ))
          `;
        } else if (id) {
          // Can delete own items OR items from shared lists
          await sql`
            DELETE FROM shopping_items 
            WHERE id = ${id as string}
              AND (user_id = ${userId} OR user_id IN (
                SELECT owner_id FROM shopping_shares WHERE shared_with_id = ${userId}
              ))
          `;
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Shopping API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
