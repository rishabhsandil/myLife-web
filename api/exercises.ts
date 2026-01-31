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
          SELECT id, name, body_part as "bodyPart", sets, reps, weight
          FROM exercises 
          WHERE user_id = ${userId}
          ORDER BY body_part, name
        `;
        return res.status(200).json(rows);
      }

      case 'POST': {
        const { id, name, bodyPart, sets, reps, weight } = req.body;
        await sql`
          INSERT INTO exercises (id, user_id, name, body_part, sets, reps, weight)
          VALUES (${id}, ${userId}, ${name}, ${bodyPart}, ${sets || 3}, ${reps || 10}, ${weight || 0})
        `;
        return res.status(201).json({ success: true });
      }

      case 'PUT': {
        const { id, name, bodyPart, sets, reps, weight } = req.body;
        await sql`
          UPDATE exercises 
          SET name = ${name}, body_part = ${bodyPart}, sets = ${sets}, reps = ${reps}, weight = ${weight}
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (id) {
          await sql`DELETE FROM exercises WHERE id = ${id as string} AND user_id = ${userId}`;
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Exercises API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
