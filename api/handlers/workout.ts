import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db.js';

export async function handleExercises(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, name, body_part as "bodyPart", sets, reps, weight, sort_order as "sortOrder"
        FROM exercises WHERE user_id = ${userId} ORDER BY body_part, sort_order ASC NULLS LAST, name
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, bodyPart, sets, reps, weight, sortOrder } = req.body;
      await sql`
        INSERT INTO exercises (id, user_id, name, body_part, sets, reps, weight, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${bodyPart}, ${sets || 3}, ${reps || 10}, ${weight || 0}, ${sortOrder !== undefined ? sortOrder : null})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, bodyPart, sets, reps, weight, sortOrder } = req.body;
      await sql`
        UPDATE exercises SET name = ${name}, body_part = ${bodyPart}, sets = ${sets}, reps = ${reps}, weight = ${weight}, sort_order = ${sortOrder !== undefined ? sortOrder : null}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM exercises WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export async function handleBodyParts(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      // Defaults are seeded once at signup (see seedDefaultsForUser).
      const rows = await sql`
        SELECT id, name, color, sort_order as "sortOrder"
        FROM body_parts WHERE user_id = ${userId} ORDER BY sort_order, created_at
      `;
      return res.status(200).json(rows);
    }
    case 'POST': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        INSERT INTO body_parts (id, user_id, name, color, sort_order)
        VALUES (${id}, ${userId}, ${name}, ${color}, ${sortOrder || 0})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, name, color, sortOrder } = req.body;
      await sql`
        UPDATE body_parts SET name = ${name}, color = ${color}, sort_order = ${sortOrder || 0}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM body_parts WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export async function handleWorkouts(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, body_part_id as "bodyPartId", body_part_name as "bodyPartName",
               date, start_time as "startTime", end_time as "endTime", duration,
               exercises, created_at as "createdAt"
        FROM workout_sessions WHERE user_id = ${userId} ORDER BY created_at DESC
      `;
      // Parse exercises JSON
      const parsed = rows.map((r: Record<string, unknown>) => ({
        ...r,
        exercises: typeof r.exercises === 'string' ? JSON.parse(r.exercises as string) : r.exercises,
      }));
      return res.status(200).json(parsed);
    }
    case 'POST': {
      try {
        const { id, bodyPartId, bodyPartName, date: clientDate, startTime, endTime, duration, exercises } = req.body;
        const date = clientDate || (startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        await sql`
          INSERT INTO workout_sessions (id, user_id, date, body_part_id, body_part_name, start_time, end_time, duration, exercises)
          VALUES (${id}, ${userId}, ${date}, ${bodyPartId}, ${bodyPartName}, ${startTime}, ${endTime || null}, ${duration || 0}, ${JSON.stringify(exercises)})
          ON CONFLICT (id) DO UPDATE SET 
            date = ${date},
            body_part_id = ${bodyPartId}, body_part_name = ${bodyPartName},
            start_time = ${startTime}, end_time = ${endTime || null},
            duration = ${duration || 0}, exercises = ${JSON.stringify(exercises)}
        `;
        return res.status(201).json({ success: true });
      } catch (error) {
        console.error('Error saving workout session:', error);
        return res.status(500).json({ error: 'Failed to save workout session', details: error instanceof Error ? error.message : String(error) });
      }
    }
    case 'PUT': {
      const { id, bodyPartId, bodyPartName, date: clientDate, startTime, endTime, duration, exercises } = req.body;
      const date = clientDate || (startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      await sql`
        UPDATE workout_sessions SET 
          date = ${date},
          body_part_id = ${bodyPartId}, body_part_name = ${bodyPartName},
          start_time = ${startTime}, end_time = ${endTime || null},
          duration = ${duration || 0}, exercises = ${JSON.stringify(exercises)}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM workout_sessions WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
