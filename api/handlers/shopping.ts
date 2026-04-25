import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db.js';

export async function handleShopping(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT si.id, si.name, si.quantity, si.store_id as "storeId", si.completed, 
          si.created_at as "createdAt", si.user_id as "ownerId",
          u.name as "ownerName", ss.name as "storeName",
          si.sort_order as "sortOrder",
          CASE WHEN si.user_id = ${userId} THEN true ELSE false END as "isOwn"
        FROM shopping_items si
        JOIN users u ON si.user_id = u.id
        LEFT JOIN shopping_stores ss ON si.store_id = ss.id
        WHERE si.user_id = ${userId}
           OR si.user_id IN (
             SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
           )
        ORDER BY si.completed ASC, si.sort_order ASC NULLS LAST, si.created_at DESC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, quantity, storeId, completed, sortOrder } = req.body;
      await sql`
        INSERT INTO shopping_items (id, user_id, name, quantity, store_id, completed, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${quantity || 1}, ${storeId}, ${completed || false}, ${sortOrder !== undefined ? sortOrder : null})
      `;
      await sql`
        INSERT INTO shopping_audit (id, user_id, action, item_name, details)
        VALUES (${Date.now().toString()}, ${userId}, 'added', ${name}, ${`Qty: ${quantity || 1}`})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, quantity, storeId, completed, sortOrder } = req.body;
      // Read previous state, then update, then audit. We don't have multi-statement
      // transactions on the serverless `sql` tag, but the SELECT → UPDATE → INSERT
      // ordering is enough for our audit semantics (idempotent + user-scoped).
      const [prev] = await sql`
        SELECT completed FROM shopping_items
        WHERE id = ${id} AND (user_id = ${userId} OR user_id IN (
          SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
        ))
      `;
      await sql`
        UPDATE shopping_items SET name = ${name}, quantity = ${quantity}, store_id = ${storeId}, completed = ${completed}, sort_order = ${sortOrder !== undefined ? sortOrder : null}
        WHERE id = ${id} AND (user_id = ${userId} OR user_id IN (
          SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
        ))
      `;
      if (prev && prev.completed !== completed) {
        await sql`
          INSERT INTO shopping_audit (id, user_id, action, item_name, details)
          VALUES (${Date.now().toString()}, ${userId}, ${completed ? 'completed' : 'uncompleted'}, ${name}, NULL)
        `;
      }
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id, clearCompleted, storeName } = req.query;
      if (clearCompleted === 'true') {
        const storeNameFilter = storeName ? storeName as string : null;
        const itemsToDelete = storeNameFilter 
          ? await sql`
              SELECT si.name FROM shopping_items si
              JOIN shopping_stores ss ON si.store_id = ss.id
              WHERE si.completed = true AND ss.name = ${storeNameFilter}
                AND (si.user_id = ${userId} OR si.user_id IN (
                  SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
                ))
            `
          : await sql`
              SELECT name FROM shopping_items WHERE completed = true 
                AND (user_id = ${userId} OR user_id IN (
                  SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
                ))
            `;
        if (storeNameFilter) {
          await sql`
            DELETE FROM shopping_items si
            USING shopping_stores ss
            WHERE si.store_id = ss.id AND si.completed = true AND ss.name = ${storeNameFilter}
              AND (si.user_id = ${userId} OR si.user_id IN (
                SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
              ))
          `;
        } else {
          await sql`
            DELETE FROM shopping_items WHERE completed = true 
              AND (user_id = ${userId} OR user_id IN (
                SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
              ))
          `;
        }
        if (itemsToDelete.length > 0) {
          await sql`
            INSERT INTO shopping_audit (id, user_id, action, item_name, details)
            VALUES (${Date.now().toString()}, ${userId}, 'cleared', ${`${itemsToDelete.length} items`}, 'Cleared completed items')
          `;
        }
      } else if (id) {
        const [item] = await sql`SELECT name FROM shopping_items WHERE id = ${id as string}`;
        await sql`
          DELETE FROM shopping_items WHERE id = ${id as string}
            AND (user_id = ${userId} OR user_id IN (
              SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
            ))
        `;
        if (item) {
          await sql`
            INSERT INTO shopping_audit (id, user_id, action, item_name, details)
            VALUES (${Date.now().toString()}, ${userId}, 'deleted', ${item.name}, NULL)
          `;
        }
      }
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export async function handleShoppingStores(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Defaults are seeded once at signup (see seedDefaultsForUser).
      // Get stores from user + shared users, deduplicated by name
      const rows = await sql`
        SELECT DISTINCT ON (ss.name) ss.id, ss.name, ss.color, ss.sort_order as "sortOrder"
        FROM shopping_stores ss
        WHERE ss.user_id = ${userId}
           OR ss.user_id IN (
             SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
           )
        ORDER BY ss.name, ss.sort_order
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        INSERT INTO shopping_stores (id, user_id, name, color, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${color}, ${sortOrder || 0})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        UPDATE shopping_stores SET name = ${name}, color = ${color}, sort_order = ${sortOrder || 0}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM shopping_stores WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// This now uses the unified user_connections table
export async function handleShoppingShare(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Return connections (bidirectional, so all connections appear as "shared with")
      const connections = await sql`
        SELECT u.id, u.email, u.name, uc.created_at as "sharedAt"
        FROM user_connections uc 
        JOIN users u ON uc.connected_user_id = u.id
        WHERE uc.user_id = ${userId}
      `;
      // For backwards compatibility, return as sharedWith (sharedBy is empty since connections are bidirectional)
      return res.status(200).json({ sharedWith: connections, sharedBy: [] });
    }
    case 'POST': {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const users = await sql`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`;
      if (users.length === 0) return res.status(404).json({ error: 'User not found' });

      const targetUser = users[0];
      if (targetUser.id === userId) return res.status(400).json({ error: 'Cannot connect with yourself' });

      const existing = await sql`
        SELECT id FROM user_connections WHERE user_id = ${userId} AND connected_user_id = ${targetUser.id}
      `;
      if (existing.length > 0) return res.status(400).json({ error: 'Already connected with this user' });

      // Create bidirectional connection
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_1`}, ${userId}, ${targetUser.id})
      `;
      await sql`
        INSERT INTO user_connections (id, user_id, connected_user_id)
        VALUES (${`conn_${Date.now()}_2`}, ${targetUser.id}, ${userId})
      `;
      return res.status(201).json({ success: true, sharedWith: { id: targetUser.id, email: targetUser.email, name: targetUser.name } });
    }
    case 'DELETE': {
      const { userId: targetUserId } = req.query;
      if (!targetUserId) return res.status(400).json({ error: 'User ID is required' });
      // Remove both directions of the connection
      await sql`DELETE FROM user_connections WHERE user_id = ${userId} AND connected_user_id = ${targetUserId as string}`;
      await sql`DELETE FROM user_connections WHERE user_id = ${targetUserId as string} AND connected_user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export async function handleShoppingAudit(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rows = await sql`
    SELECT sa.id, sa.action, sa.item_name as "itemName", sa.details,
      sa.created_at as "createdAt", u.name as "userName"
    FROM shopping_audit sa JOIN users u ON sa.user_id = u.id
    WHERE sa.user_id = ${userId}
       OR sa.user_id IN (
         SELECT connected_user_id FROM user_connections WHERE user_id = ${userId}
       )
    ORDER BY sa.created_at DESC LIMIT 50
  `;
  return res.status(200).json(rows);
}
