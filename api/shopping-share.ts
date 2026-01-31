import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getUserIdFromRequest } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
      // Get sharing status - who I share with and who shares with me
      case 'GET': {
        // People I share my list with
        const sharedWith = await sql`
          SELECT u.id, u.email, u.name, ss.created_at as "sharedAt"
          FROM shopping_shares ss
          JOIN users u ON ss.shared_with_id = u.id
          WHERE ss.owner_id = ${userId}
        `;

        // People who share their list with me
        const sharedBy = await sql`
          SELECT u.id, u.email, u.name, ss.created_at as "sharedAt"
          FROM shopping_shares ss
          JOIN users u ON ss.owner_id = u.id
          WHERE ss.shared_with_id = ${userId}
        `;

        return res.status(200).json({ sharedWith, sharedBy });
      }

      // Share my list with another user (by email)
      case 'POST': {
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({ error: 'Email is required' });
        }

        // Find user by email
        const users = await sql`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`;
        
        if (users.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = users[0];

        if (targetUser.id === userId) {
          return res.status(400).json({ error: 'Cannot share with yourself' });
        }

        // Check if already shared
        const existing = await sql`
          SELECT id FROM shopping_shares 
          WHERE owner_id = ${userId} AND shared_with_id = ${targetUser.id}
        `;

        if (existing.length > 0) {
          return res.status(400).json({ error: 'Already shared with this user' });
        }

        // Create share
        const shareId = `share_${Date.now()}`;
        await sql`
          INSERT INTO shopping_shares (id, owner_id, shared_with_id)
          VALUES (${shareId}, ${userId}, ${targetUser.id})
        `;

        return res.status(201).json({ 
          success: true, 
          sharedWith: { id: targetUser.id, email: targetUser.email, name: targetUser.name }
        });
      }

      // Remove share
      case 'DELETE': {
        const { userId: targetUserId } = req.query;

        if (!targetUserId) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        await sql`
          DELETE FROM shopping_shares 
          WHERE owner_id = ${userId} AND shared_with_id = ${targetUserId as string}
        `;

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Shopping share API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
