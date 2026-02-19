import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { sql } from './db.js';

// Configure web-push with VAPID keys (must be set in environment variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@almostadult.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// Send notification helper
async function sendNotificationToUser(userId: string, notification: { title: string; body: string; tag?: string; url?: string }) {
  const subscriptions = await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  `;
  
  if (subscriptions.length === 0) return;
  
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: '/logo.png',
    tag: notification.tag || 'notification',
    data: { url: notification.url || '/' }
  });
  
  for (const sub of subscriptions) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        } as any,
        payload
      );
    } catch (error: unknown) {
      console.error('Push notification failed:', error);
      if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
      }
    }
  }
}

// Main cron handler
// IMPORTANT: Vercel Hobby accounts only support daily cron jobs (default: runs at midnight UTC)
// For minute-level precision (to send reminders at exact times):
//   1. Upgrade to Vercel Pro, OR
//   2. Use an external service like cron-job.org to call this endpoint every minute
//      with ?secret=YOUR_CRON_SECRET query parameter
// Called by Vercel Cron or external cron service
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS for cron service
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-Cron-Secret');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify request is authorized
  // Accepts: Authorization header, X-Cron-Secret header, or ?secret= query param
  const authHeader = req.headers.authorization;
  const cronSecretHeader = req.headers['x-cron-secret'];
  const querySecret = req.query.secret;
  const cronSecret = process.env.CRON_SECRET;
  
  const isAuthorized = 
    (authHeader === `Bearer ${cronSecret}`) ||
    (cronSecretHeader === cronSecret) ||
    (querySecret === cronSecret) ||
    (!cronSecret && process.env.NODE_ENV !== 'production'); // Allow in dev without secret
  
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // NOTE: initDb() removed from cron to save compute. Run it once via /api/init endpoint.
    
    const results = {
      reminders: 0,
      periodReminders: 0,
      errors: [] as string[]
    };

    // ============ CHECK REMINDER NOTIFICATIONS ============
    // Get current time in various timezones (we'll check for tasks due "now")
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    
    // Format time as HH:MM for comparison (check current minute and next minute for buffer)
    const timeNow = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    const timeNext = `${String(currentHour).padStart(2, '0')}:${String((currentMinute + 1) % 60).padStart(2, '0')}`;
    
    // Find tasks that are due now (have time set matching current time)
    // We check for both the task owner and assigned user
    const dueTasks = await sql`
      SELECT t.id, t.title, t.time, t.date, t.user_id, t.assigned_to_user_id,
             t.recurrence, t.completed, t.completed_dates, t.excluded_dates, t.recurrence_days
      FROM todos t
      WHERE t.time IS NOT NULL 
        AND t.time IN (${timeNow}, ${timeNext})
        AND t.completed = false
        AND (
          t.date = ${currentDate}
          OR t.recurrence != 'none'
        )
    `;

    for (const task of dueTasks) {
      try {
        // Check if this is a recurring task that applies today
        if (task.recurrence !== 'none') {
          const completedDates = task.completed_dates || [];
          const excludedDates = task.excluded_dates || [];
          
          // Skip if already completed or excluded for today
          if (completedDates.includes(currentDate) || excludedDates.includes(currentDate)) {
            continue;
          }
          
          // Check if recurrence applies today
          const taskDate = new Date(task.date);
          const today = new Date(currentDate);
          
          if (task.recurrence === 'daily') {
            // Always applies
          } else if (task.recurrence === 'weekly') {
            if (taskDate.getDay() !== today.getDay()) continue;
          } else if (task.recurrence === 'biweekly') {
            const daysDiff = Math.floor((today.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff < 0 || daysDiff % 14 !== 0) continue;
          } else if (task.recurrence === 'monthly') {
            const originalDay = taskDate.getDate();
            const todayDay = today.getDate();
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            // If original day doesn't exist in current month, trigger on last day of month
            const shouldTrigger = originalDay > lastDayOfMonth 
              ? todayDay === lastDayOfMonth 
              : todayDay === originalDay;
            if (!shouldTrigger) continue;
          } else if (task.recurrence === 'yearly') {
            if (taskDate.getMonth() !== today.getMonth() || taskDate.getDate() !== today.getDate()) continue;
          } else if (task.recurrence === 'custom') {
            const days = task.recurrence_days || [];
            if (!days.includes(today.getDay())) continue;
          }
        }
        
        // Send notification to task owner
        await sendNotificationToUser(task.user_id, {
          title: '⏰ Reminder',
          body: task.title,
          tag: `reminder-${task.id}-${currentDate}`,
          url: '/'
        });
        results.reminders++;
        
        // Also notify assignee if different from owner
        if (task.assigned_to_user_id && task.assigned_to_user_id !== task.user_id) {
          await sendNotificationToUser(task.assigned_to_user_id, {
            title: '⏰ Reminder',
            body: task.title,
            tag: `reminder-${task.id}-${currentDate}`,
            url: '/'
          });
          results.reminders++;
        }
      } catch (error) {
        results.errors.push(`Task ${task.id}: ${String(error)}`);
      }
    }

    // ============ MOVE OVERDUE TASKS FORWARD ============
    // Server-side: move non-recurring past-date tasks to today (single bulk UPDATE)
    const overduResult = await sql`
      UPDATE todos
      SET original_date = COALESCE(original_date, date),
          date = ${currentDate},
          overdue = true
      WHERE completed = false
        AND date < ${currentDate}
        AND date != 'backlog'
        AND (recurrence = 'none' OR recurrence IS NULL)
    `;

    // ============ CHECK PERIOD PREDICTION REMINDERS ============
    // Get users with period tracking enabled and notify_days_before set
    const periodUsers = await sql`
      SELECT ps.user_id, ps.average_cycle_length, ps.notify_days_before,
             (SELECT MAX(start_date) FROM period_cycles WHERE user_id = ps.user_id) as last_period
      FROM period_settings ps
      WHERE ps.notify_days_before > 0
    `;

    for (const user of periodUsers) {
      try {
        if (!user.last_period) continue;
        
        const lastPeriodDate = new Date(user.last_period);
        const predictedNext = new Date(lastPeriodDate);
        predictedNext.setDate(predictedNext.getDate() + user.average_cycle_length);
        
        // Calculate days until predicted period
        const today = new Date(currentDate);
        const daysUntil = Math.floor((predictedNext.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Notify if days until matches notify_days_before (only at a specific time, e.g., 9 AM UTC)
        if (daysUntil === user.notify_days_before && currentHour === 9 && currentMinute < 2) {
          await sendNotificationToUser(user.user_id, {
            title: '🩸 Period Reminder',
            body: daysUntil === 1 
              ? 'Your period is predicted to start tomorrow'
              : `Your period is predicted to start in ${daysUntil} days`,
            tag: `period-${currentDate}`,
            url: '/period'
          });
          results.periodReminders++;
        }
      } catch (error) {
        results.errors.push(`Period user ${user.user_id}: ${String(error)}`);
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: now.toISOString(),
      results
    });
  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
