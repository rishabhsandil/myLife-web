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
        const rows = await sql`
          SELECT id, date, exercises
          FROM workout_sessions 
          WHERE user_id = ${userId}
          ORDER BY date DESC
        `;
        return res.status(200).json(rows);
      }

      case 'POST': {
        const { id, date, exercises } = req.body;
        // Upsert: insert or update if date exists
        await sql`
          INSERT INTO workout_sessions (id, user_id, date, exercises)
          VALUES (${id}, ${userId}, ${date}, ${JSON.stringify(exercises)})
          ON CONFLICT (id) DO UPDATE SET exercises = ${JSON.stringify(exercises)}
        `;
        return res.status(201).json({ success: true });
      }

      case 'PUT': {
        const { id, date, exercises } = req.body;
        await sql`
          UPDATE workout_sessions 
          SET date = ${date}, exercises = ${JSON.stringify(exercises)}
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (id) {
          await sql`DELETE FROM workout_sessions WHERE id = ${id as string} AND user_id = ${userId}`;
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Workouts API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
