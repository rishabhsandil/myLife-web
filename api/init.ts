import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDb } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await initDb();
    res.status(200).json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ error: 'Failed to initialize database' });
  }
}
