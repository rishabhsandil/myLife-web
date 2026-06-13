import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, notifyConnectionChange } from '../db.js';

export async function handleUserSearch(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  // Only search among connected users
  const users = await sql`
    SELECT u.id, u.name, u.email
    FROM users u
    WHERE u.id IN (
      SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
      UNION
      SELECT user_id FROM user_connections WHERE connected_user_id = ${userId}
    )
    AND LOWER(u.email) LIKE LOWER(${`%${email}%`})
    AND u.id != ${userId}
    LIMIT 10
  `;

  return res.status(200).json(users);
}

export async function handleConnections(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Get all connections (bidirectional)
      const connections = await sql`
        SELECT u.id, u.name, u.email, uc.created_at as "connectedAt"
        FROM users u
        INNER JOIN user_connections uc ON (
          (uc.connected_user_id = u.id AND uc.user_id = ${userId})
          OR (uc.user_id = u.id AND uc.connected_user_id = ${userId})
        )
        WHERE u.id != ${userId}
        ORDER BY u.name
      `;
      // Deduplicate (since bidirectional connections may show twice)
      const uniqueConnections = Array.from(
        new Map(connections.map((c) => [c.id, c])).values()
      );
      return res.status(200).json(uniqueConnections);
    }
    case 'POST': {
      // Add connection by email
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      // Find user by exact email
      const users = await sql`
        SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(${email}) AND id != ${userId}
      `;

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const targetUser = users[0];

      // Check if connection already exists
      const existing = await sql`
        SELECT id FROM user_connections 
        WHERE (user_id = ${userId} AND connected_user_id = ${targetUser.id})
           OR (user_id = ${targetUser.id} AND connected_user_id = ${userId})
      `;

      if (existing.length > 0) {
        return res.status(200).json({ 
          success: true, 
          user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
          message: 'Already connected' 
        });
      }

      // Create bidirectional connection
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_1`}, ${userId}, ${targetUser.id})
      `;
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_2`}, ${targetUser.id}, ${userId})
      `;

      await notifyConnectionChange(userId, targetUser.id as string, true);
      return res.status(201).json({
        success: true,
        user: { id: targetUser.id, name: targetUser.name, email: targetUser.email }
      });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Connection user ID required' });
      }

      // Delete both directions
      await sql`
        DELETE FROM user_connections
        WHERE (user_id = ${userId} AND connected_user_id = ${id})
           OR (user_id = ${id} AND connected_user_id = ${userId})
      `;

      await notifyConnectionChange(userId, id, false);
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
