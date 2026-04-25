import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db.js';

export async function handleNotes(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, title, content, color, created_at as "createdAt", updated_at as "updatedAt", sort_order as "sortOrder"
        FROM notes WHERE user_id = ${userId} ORDER BY updated_at DESC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, title, content, color, createdAt, updatedAt, sortOrder } = req.body;
      await sql`
        INSERT INTO notes (id, user_id, title, content, color, created_at, updated_at, sort_order)
        VALUES (${id}, ${userId}, ${title}, ${content || ''}, ${color || '#FFFFFF'}, ${createdAt}, ${updatedAt}, ${sortOrder !== undefined ? sortOrder : null})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, content, color, updatedAt, sortOrder } = req.body;
      await sql`
        UPDATE notes SET title = ${title}, content = ${content}, color = ${color}, updated_at = ${updatedAt}, sort_order = ${sortOrder !== undefined ? sortOrder : null}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM notes WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
