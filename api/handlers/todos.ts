import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, sendPushToUsers } from '../db.js';

/** Notify a user that `actorId` assigned them a task. No-op for self-assign. */
async function notifyAssignment(actorId: string, assigneeId: string, title: string, todoId: string) {
  if (!assigneeId || assigneeId === actorId) return;
  const [actor] = await sql`SELECT name FROM users WHERE id = ${actorId}`;
  await sendPushToUsers([assigneeId], {
    title: 'New task assigned',
    body: `${actor?.name ?? 'Someone'} assigned you "${title}"`,
    data: { type: 'task-assigned', todoId },
  });
}

export async function handleTodos(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT t.id, t.title, t.completed, t.date, t.time, t.priority, t.recurrence,
          t.completed_dates as "completedDates", t.excluded_dates as "excludedDates", 
          t.created_at as "createdAt", t.category, t.original_date as "originalDate", t.overdue,
          t.sort_order as "sortOrder", t.user_id as "ownerId", t.assigned_to_user_id as "assignedToUserId",
          t.backlog_month as "backlogMonth", t.recurrence_days as "recurrenceDays",
          owner.name as "ownerName", owner.email as "ownerEmail",
          assignee.name as "assigneeName", assignee.email as "assigneeEmail"
        FROM todos t
        JOIN users owner ON t.user_id = owner.id
        LEFT JOIN users assignee ON t.assigned_to_user_id = assignee.id
        WHERE t.user_id = ${userId} OR t.assigned_to_user_id = ${userId}
        ORDER BY t.date ASC, t.time ASC
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category, originalDate, overdue, sortOrder, assignedToUserId, backlogMonth, recurrenceDays } = req.body;
      await sql`
        INSERT INTO todos (id, user_id, title, completed, date, time, priority, recurrence, completed_dates, excluded_dates, category, original_date, overdue, sort_order, assigned_to_user_id, backlog_month, recurrence_days)
        VALUES (${id}, ${userId}, ${title}, ${completed || false}, ${date}, ${time || null}, ${priority || 'medium'}, ${recurrence || 'none'}, ${completedDates || []}, ${excludedDates || []}, ${category || null}, ${originalDate || null}, ${overdue || false}, ${sortOrder !== undefined ? sortOrder : null}, ${assignedToUserId || null}, ${backlogMonth || null}, ${recurrenceDays || null})
      `;

      if (assignedToUserId) await notifyAssignment(userId, assignedToUserId, title, id);
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, completed, date, time, priority, recurrence, completedDates, excludedDates, category, originalDate, overdue, sortOrder, assignedToUserId, backlogMonth, recurrenceDays } = req.body;
      // Read the prior assignee so we only notify when it actually changes.
      const [prevAssign] = await sql`
        SELECT assigned_to_user_id as "assignedToUserId" FROM todos
        WHERE id = ${id} AND (user_id = ${userId} OR assigned_to_user_id = ${userId})
      `;
      await sql`
        UPDATE todos SET title = ${title}, completed = ${completed},
          date = ${date}, time = ${time || null}, priority = ${priority}, recurrence = ${recurrence},
          completed_dates = ${completedDates || []}, excluded_dates = ${excludedDates || []}, category = ${category || null},
          original_date = ${originalDate || null}, overdue = ${overdue || false}, sort_order = ${sortOrder !== undefined ? sortOrder : null},
          assigned_to_user_id = ${assignedToUserId !== undefined ? assignedToUserId : null},
          backlog_month = ${backlogMonth !== undefined ? backlogMonth : null},
          recurrence_days = ${recurrenceDays || null}
        WHERE id = ${id} AND (user_id = ${userId} OR assigned_to_user_id = ${userId})
      `;
      if (assignedToUserId && assignedToUserId !== prevAssign?.assignedToUserId) {
        await notifyAssignment(userId, assignedToUserId, title, id);
      }
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
}

export async function handleTodosReorder(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty array of {id, sortOrder}' });
  }
  const ids: string[] = items.map((i: { id: string }) => i.id);
  const orders: number[] = items.map((i: { sortOrder: number }) => Number(i.sortOrder));
  await sql`
    UPDATE todos SET sort_order = u.sort_order
    FROM unnest(${ids}::text[], ${orders}::int[]) AS u(id, sort_order)
    WHERE todos.id = u.id AND todos.user_id = ${userId}
  `;
  return res.status(204).end();
}

export async function handleTodoCategories(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Defaults are seeded once at signup (see seedDefaultsForUser).
      const ownCategories = await sql`
        SELECT id, name, color, sort_order as "sortOrder"
        FROM todo_categories WHERE user_id = ${userId} ORDER BY sort_order, created_at
      `;
      return res.status(200).json(ownCategories);
    }
    case 'POST': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        INSERT INTO todo_categories (id, user_id, name, color, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${color}, ${sortOrder || 0})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        UPDATE todo_categories SET name = ${name}, color = ${color}, sort_order = ${sortOrder || 0}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM todo_categories WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
