import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getUserIdFromRequest } from '../db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
            average_cycle_length as "averageCycleLength",
            average_period_length as "averagePeriodLength",
            notify_days_before as "notifyDaysBefore"
          FROM period_settings 
          WHERE user_id = ${userId}
        `;
        
        if (rows.length === 0) {
          // Return defaults if no settings exist
          return res.status(200).json({
            averageCycleLength: 28,
            averagePeriodLength: 5,
            notifyDaysBefore: 2,
          });
        }
        
        return res.status(200).json(rows[0]);
      }

      case 'POST': {
        const { averageCycleLength, averagePeriodLength, notifyDaysBefore } = req.body;
        
        // Upsert settings
        await sql`
          INSERT INTO period_settings (user_id, average_cycle_length, average_period_length, notify_days_before)
          VALUES (${userId}, ${averageCycleLength}, ${averagePeriodLength}, ${notifyDaysBefore || 2})
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            average_cycle_length = ${averageCycleLength},
            average_period_length = ${averagePeriodLength},
            notify_days_before = ${notifyDaysBefore || 2}
        `;
        
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Period settings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
