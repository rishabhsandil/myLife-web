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
            id, title, description, completed, date, time, priority, recurrence,
            completed_dates as "completedDates", 
            excluded_dates as "excludedDates", 
            is_event as "isEvent",
            created_at as "createdAt"
          FROM todos 
          WHERE user_id = ${userId}
          ORDER BY date ASC, time ASC
        `;
        return res.status(200).json(rows);
      }

      case 'POST': {
        const { id, title, description, completed, date, time, priority, recurrence, completedDates, excludedDates, isEvent } = req.body;
        await sql`
          INSERT INTO todos (id, user_id, title, description, completed, date, time, priority, recurrence, completed_dates, excluded_dates, is_event)
          VALUES (${id}, ${userId}, ${title}, ${description || null}, ${completed || false}, ${date}, ${time || null}, ${priority || 'medium'}, ${recurrence || 'none'}, ${completedDates || []}, ${excludedDates || []}, ${isEvent || false})
        `;
        return res.status(201).json({ success: true });
      }

      case 'PUT': {
        const { id, title, description, completed, date, time, priority, recurrence, completedDates, excludedDates, isEvent } = req.body;
        await sql`
          UPDATE todos 
          SET title = ${title}, description = ${description || null}, completed = ${completed}, 
              date = ${date}, time = ${time || null}, priority = ${priority}, recurrence = ${recurrence},
              completed_dates = ${completedDates || []}, excluded_dates = ${excludedDates || []}, is_event = ${isEvent || false}
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (id) {
          await sql`DELETE FROM todos WHERE id = ${id as string} AND user_id = ${userId}`;
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Todos API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
