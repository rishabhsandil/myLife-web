import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserIdFromRequest, initDb } from './db.js';
import {
  handleLogin,
  handleSignup,
  handleRefresh,
  handleLogout,
  handleMe,
  handleDeleteAccount,
  handleForgotPassword,
  handleResetPassword,
  handleVerifyEmail,
  handleResendVerification,
} from './handlers/auth.js';
import { handleTodos, handleTodoCategories } from './handlers/todos.js';
import { handleUserSearch, handleConnections } from './handlers/social.js';
import {
  handleShopping,
  handleShoppingStores,
  handleShoppingShare,
  handleShoppingAudit,
} from './handlers/shopping.js';
import { handleExercises, handleBodyParts, handleWorkouts } from './handlers/workout.js';
import { handleNotes } from './handlers/notes.js';
import { handleUserSettings } from './handlers/settings.js';
import {
  handleRecipes,
  handleRecipeShare,
  handleSharedRecipes,
  handleRecipeExtract,
} from './handlers/recipes.js';

// Allowed origins for CORS (configure via environment variable)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

// CORS helper with origin validation
function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;

  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin && process.env.NODE_ENV !== 'production') {
    // Allow requests without origin in development (e.g., curl, Postman)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the route from query parameter
  const { route } = req.query;
  const routePath = Array.isArray(route) ? route.join('/') : route || '';

  try {
    // ============ INIT ============
    if (routePath === 'init') {
      // Require a secret key so this endpoint can't be triggered by anyone.
      const secret = req.headers['x-init-secret'] ?? req.query['secret'];
      const expected = process.env.INIT_SECRET;
      if (!expected || secret !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await initDb();
      return res.status(200).json({ message: 'Database initialized successfully' });
    }

    // ============ AUTH ROUTES (no auth required) ============
    if (routePath === 'auth/login') {
      return handleLogin(req, res);
    }
    if (routePath === 'auth/signup') {
      return handleSignup(req, res);
    }
    if (routePath === 'auth/refresh') {
      return handleRefresh(req, res);
    }
    if (routePath === 'auth/logout') {
      return handleLogout(req, res);
    }
    if (routePath === 'auth/forgot-password') {
      return handleForgotPassword(req, res);
    }
    if (routePath === 'auth/reset-password') {
      return handleResetPassword(req, res);
    }

    // ============ AUTH REQUIRED ROUTES ============
    const userId = getUserIdFromRequest(req);

    if (routePath === 'auth/me') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      return handleMe(req, res, userId);
    }
    if (routePath === 'auth/verify-email') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      return handleVerifyEmail(req, res, userId);
    }
    if (routePath === 'auth/resend-verification') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      return handleResendVerification(req, res, userId);
    }
    if (routePath === 'auth/account') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      return handleDeleteAccount(req, res, userId);
    }

    // All other routes require auth
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Route to appropriate handler
    switch (routePath) {
      case 'todos':
        return handleTodos(req, res, userId);
      case 'todo-categories':
        return handleTodoCategories(req, res, userId);
      case 'users/search':
        return handleUserSearch(req, res, userId);
      case 'connections':
        return handleConnections(req, res, userId);
      case 'shopping':
        return handleShopping(req, res, userId);
      case 'shopping-stores':
        return handleShoppingStores(req, res, userId);
      case 'shopping-share':
        return handleShoppingShare(req, res, userId);
      case 'shopping-audit':
        return handleShoppingAudit(req, res, userId);
      case 'exercises':
        return handleExercises(req, res, userId);
      case 'bodyparts':
        return handleBodyParts(req, res, userId);
      case 'notes':
        return handleNotes(req, res, userId);
      case 'workouts':
        return handleWorkouts(req, res, userId);
      case 'settings':
        return handleUserSettings(req, res, userId);
      case 'recipes':
        return handleRecipes(req, res, userId);
      case 'recipes/share':
        return handleRecipeShare(req, res, userId);
      case 'recipes/shared':
        return handleSharedRecipes(req, res, userId);
      case 'recipes/extract':
        return handleRecipeExtract(req, res, userId);
      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
