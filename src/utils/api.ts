import { TodoItem, ShoppingItem, ShoppingStore, Exercise, BodyPart, ShoppingShareStatus, ShoppingShareUser, ShoppingAuditEntry, UserSettings, ModuleType, Note, WorkoutSession, Recipe } from '../types';

// API base URL - empty for same origin (Vercel), or set for local dev
const API_BASE = import.meta.env.VITE_API_URL || '';

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

// Generic API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/api/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData.error || errorData.details || `API error: ${res.status}`;
    throw new Error(errorMsg);
  }
  return res.json();
}

// Generic CRUD factory for entities
interface Entity { id: string }

function createCrudApi<T extends Entity>(
  endpoint: string,
  localStorageKey: string
) {
  return {
    async getAll(): Promise<T[]> {
      try {
        return await api<T[]>(endpoint);
      } catch (error) {
        console.error(`Failed to fetch ${endpoint}:`, error);
        const data = localStorage.getItem(localStorageKey);
        return data ? JSON.parse(data) : [];
      }
    },

    async create(item: T): Promise<void> {
      try {
        await api(endpoint, {
          method: 'POST',
          body: JSON.stringify(item),
        });
      } catch (error) {
        console.error(`Failed to create ${endpoint}:`, error);
      }
    },

    async update(item: T): Promise<void> {
      try {
        await api(endpoint, {
          method: 'PUT',
          body: JSON.stringify(item),
        });
      } catch (error) {
        console.error(`Failed to update ${endpoint}:`, error);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        await api(`${endpoint}?id=${id}`, { method: 'DELETE' });
      } catch (error) {
        console.error(`Failed to delete ${endpoint}:`, error);
      }
    },

    saveToLocalStorage(items: T[]): void {
      localStorage.setItem(localStorageKey, JSON.stringify(items));
    },
  };
}

// Create CRUD APIs for each entity
const todosApi = createCrudApi<TodoItem>('todos', 'almostadult_todos');
const shoppingApi = createCrudApi<ShoppingItem>('shopping', 'almostadult_shopping');
const shoppingStoresApi = createCrudApi<ShoppingStore>('shopping-stores', 'almostadult_shopping_stores');
const exercisesApi = createCrudApi<Exercise>('exercises', 'almostadult_exercises');
const bodyPartsApi = createCrudApi<BodyPart>('bodyparts', 'almostadult_bodyparts');
const notesApi = createCrudApi<Note>('notes', 'almostadult_notes');

// ============ TODOS ============
export const getTodos = todosApi.getAll;
export const saveTodo = todosApi.create;
export const updateTodo = todosApi.update;
export const deleteTodo = todosApi.delete;
export const saveTodos = todosApi.saveToLocalStorage;

// ============ SHOPPING ============
export const getShoppingItems = shoppingApi.getAll;
export const saveShoppingItem = shoppingApi.create;
export const updateShoppingItem = shoppingApi.update;
export const deleteShoppingItem = shoppingApi.delete;
export const saveShoppingItems = shoppingApi.saveToLocalStorage;

// ============ SHOPPING STORES ============
export const getShoppingStores = shoppingStoresApi.getAll;
export const saveShoppingStore = shoppingStoresApi.create;
export const updateShoppingStore = shoppingStoresApi.update;
export const deleteShoppingStore = shoppingStoresApi.delete;

export async function clearCompletedItems(storeName?: string): Promise<void> {
  try {
    const url = storeName 
      ? `shopping?clearCompleted=true&storeName=${encodeURIComponent(storeName)}` 
      : 'shopping?clearCompleted=true';
    await api(url, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to clear completed items:', error);
  }
}

// ============ SHOPPING SHARING ============
export async function getShoppingShareStatus(): Promise<ShoppingShareStatus> {
  try {
    return await api<ShoppingShareStatus>('shopping-share');
  } catch (error) {
    console.error('Failed to get share status:', error);
    return { sharedWith: [], sharedBy: [] };
  }
}

export async function shareShoppingList(email: string): Promise<{ success: boolean; error?: string; sharedWith?: ShoppingShareUser }> {
  try {
    const result = await api<{ success: boolean; sharedWith: ShoppingShareUser }>('shopping-share', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return result;
  } catch (error) {
    console.error('Failed to share list:', error);
    return { success: false, error: 'Failed to share list' };
  }
}

export async function unshareShoppingList(userId: string): Promise<void> {
  try {
    await api(`shopping-share?userId=${userId}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to unshare list:', error);
  }
}

// ============ SHOPPING AUDIT ============
export async function getShoppingAudit(): Promise<ShoppingAuditEntry[]> {
  try {
    return await api<ShoppingAuditEntry[]>('shopping-audit');
  } catch (error) {
    console.error('Failed to get audit history:', error);
    return [];
  }
}

// ============ EXERCISES ============
export const getExercises = exercisesApi.getAll;
export const saveExercise = exercisesApi.create;
export const updateExercise = exercisesApi.update;
export const deleteExercise = exercisesApi.delete;
export const saveExercises = exercisesApi.saveToLocalStorage;

// ============ BODY PARTS ============
export const getBodyParts = bodyPartsApi.getAll;
export const saveBodyPart = bodyPartsApi.create;
export const updateBodyPart = bodyPartsApi.update;
export const deleteBodyPart = bodyPartsApi.delete;

// ============ WORKOUT SESSIONS ============
export async function getWorkoutSessions(): Promise<WorkoutSession[]> {
  try {
    return await api<WorkoutSession[]>('workouts');
  } catch (error) {
    console.error('Failed to fetch workout sessions:', error);
    const data = localStorage.getItem('almostadult_workout_sessions');
    return data ? JSON.parse(data) : [];
  }
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<void> {
  try {
    await api('workouts', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  } catch (error) {
    console.error('Failed to save workout session:', error);
    throw error;
  }
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  try {
    await api(`workouts?id=${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to delete workout session:', error);
  }
}

// ============ NOTES ============
export const getNotes = notesApi.getAll;
export const saveNote = notesApi.create;
export const updateNote = notesApi.update;
export const deleteNote = notesApi.delete;
export const saveNotesLocal = notesApi.saveToLocalStorage;

// ============ TODO CATEGORIES ============
const todoCategoriesApi = createCrudApi<{ id: string; name: string; color: string; sortOrder: number }>('todo-categories', 'almostadult_todo_categories');

export const getTodoCategories = todoCategoriesApi.getAll;
export const saveTodoCategory = todoCategoriesApi.create;
export const updateTodoCategory = todoCategoriesApi.update;
export const deleteTodoCategory = todoCategoriesApi.delete;


// ============ USER SETTINGS (Module Configuration) ============
const DEFAULT_ENABLED_MODULES: ModuleType[] = ['todos', 'shopping', 'workout', 'notes'];

export async function getUserSettings(): Promise<UserSettings> {
  try {
    return await api<UserSettings>('settings');
  } catch (error) {
    console.error('Failed to fetch user settings:', error);
    const stored = localStorage.getItem('almostadult_user_settings');
    return stored ? JSON.parse(stored) : { enabledModules: DEFAULT_ENABLED_MODULES };
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  try {
    await api('settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    localStorage.setItem('almostadult_user_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save user settings:', error);
  }
}

// ============ USER SEARCH ============
export async function searchUsers(email: string): Promise<Array<{ id: string; name: string; email: string }>> {
  try {
    return await api<Array<{ id: string; name: string; email: string }>>(`users/search?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('Failed to search users:', error);
    return [];
  }
}

// ============ CONNECTIONS ============
export interface UserConnection {
  id: string;
  name: string;
  email: string;
  connectedAt?: string;
}

export async function getConnections(): Promise<UserConnection[]> {
  try {
    return await api<UserConnection[]>('connections');
  } catch (error) {
    console.error('Failed to get connections:', error);
    return [];
  }
}

export async function addConnection(email: string): Promise<{ success: boolean; user?: UserConnection; error?: string }> {
  try {
    return await api<{ success: boolean; user?: UserConnection; error?: string }>('connections', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    console.error('Failed to add connection:', error);
    return { success: false, error: 'User not found' };
  }
}

export async function removeConnection(userId: string): Promise<void> {
  try {
    await api(`connections?id=${userId}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to remove connection:', error);
  }
}
// ============ RECIPES ============
const recipesApi = createCrudApi<Recipe>('recipes', 'almostadult_recipes');

export const getRecipes = recipesApi.getAll;
export const saveRecipe = recipesApi.create;
export const updateRecipe = recipesApi.update;
export const deleteRecipe = recipesApi.delete;

export interface RecipeExtractResult {
  title: string;
  description?: string;
  ingredients?: Array<{ amount?: string; unit?: string; name: string }>;
  instructions?: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags?: string[];
  sourceUrl?: string;
  sourcePlatform?: 'youtube' | 'manual';
  thumbnail?: string;
  channelName?: string;
  error?: string;
}

export async function extractRecipeFromUrl(url: string): Promise<RecipeExtractResult> {
  const result = await api<RecipeExtractResult>('recipes/extract', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return result;
}

export async function parseRecipeFromText(text: string): Promise<RecipeExtractResult> {
  const result = await api<RecipeExtractResult>('recipes/extract', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return result;
}