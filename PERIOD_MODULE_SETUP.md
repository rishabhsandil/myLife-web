# Period Tracking Module - Database Setup

## Database Migration Required

Yes, you need to run a database migration to create the new tables for the period tracking module.

## How to Run the Migration

### Option 1: Using the Init Endpoint (Recommended for Production)

If you're deployed on Vercel:

1. Visit your deployed app's init endpoint:
   ```
   https://your-app.vercel.app/api/init
   ```

2. You should see a success message:
   ```json
   { "message": "Database initialized successfully" }
   ```

### Option 2: Local Development

If running locally, you can call the init endpoint:

```bash
curl http://localhost:5173/api/init
```

Or visit `http://localhost:5173/api/init` in your browser.

## What Tables Will Be Created

### 1. `period_cycles` Table
Stores individual period cycle records:
- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, FOREIGN KEY to users)
- `start_date` (TEXT)
- `end_date` (TEXT, nullable - for ongoing periods)
- `created_at` (TIMESTAMP)

### 2. `period_settings` Table
Stores user preferences for period predictions:
- `user_id` (TEXT, PRIMARY KEY, FOREIGN KEY to users)
- `average_cycle_length` (INTEGER, default 28)
- `average_period_length` (INTEGER, default 5)
- `notify_days_before` (INTEGER, default 2)
- `updated_at` (TIMESTAMP)

## Features Included

✅ **Date Tracking**: Log period start and end dates
✅ **Calendar Visualization**: Visual calendar showing period days and predictions
✅ **Smart Predictions**: Automatically predicts next period based on cycle history
✅ **Notifications**: Visual alert when period is within notification window (default 2 days)
✅ **Customizable Settings**: Adjust cycle length, period length, and notification timing
✅ **History**: View all past cycles with duration

## Notification Behavior

- The app will show a warning emoji (⚠️) in the header when the predicted period is within the notification window
- Default notification window is 2 days before predicted period
- Users can customize this in Settings (0-7 days)
- Example: If notification is set to 2 days, user will see "⚠️ Period expected in 2 days"

## Notes

- The init endpoint uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times
- Existing tables won't be affected
- No data will be lost if tables already exist
- All period data is user-specific and protected by authentication
