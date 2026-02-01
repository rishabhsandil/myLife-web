import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getUserIdFromRequest } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
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
        const rows = await sql`
          SELECT 
            id, 
            start_date as "startDate", 
            end_date as "endDate", 
            created_at as "createdAt"
          FROM period_cycles 
          WHERE user_id = ${userId}
          ORDER BY start_date DESC
        `;
        return res.status(200).json(rows);
      }

      case 'POST': {
        const { id, startDate, endDate } = req.body;
        await sql`
          INSERT INTO period_cycles (id, user_id, start_date, end_date)
          VALUES (${id}, ${userId}, ${startDate}, ${endDate || null})
        `;
        return res.status(201).json({ success: true });
      }

      case 'PUT': {
        const { id, startDate, endDate } = req.body;
        await sql`
          UPDATE period_cycles 
          SET start_date = ${startDate}, end_date = ${endDate || null}
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (id) {
          await sql`DELETE FROM period_cycles WHERE id = ${id as string} AND user_id = ${userId}`;
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Periods API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
