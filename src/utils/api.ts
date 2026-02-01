import { TodoItem, ShoppingItem, ShoppingStore, Exercise, BodyPart, ShoppingShareStatus, ShoppingShareUser, ShoppingAuditEntry, PeriodCycle, PeriodSettings, UserSettings, ModuleType } from '../types';

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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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

export async function clearCompletedItems(storeId?: string): Promise<void> {
  try {
    const url = storeId 
      ? `shopping?clearCompleted=true&storeId=${storeId}` 
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

// ============ PERIOD TRACKING ============
const periodApi = createCrudApi<PeriodCycle>('periods', 'almostadult_periods');

export const getPeriods = periodApi.getAll;
export const savePeriod = periodApi.create;
export const updatePeriod = periodApi.update;
export const deletePeriod = periodApi.delete;

export async function getPeriodSettings(): Promise<PeriodSettings> {
  try {
    const settings = await api<PeriodSettings>('periods/settings');
    return settings;
  } catch (error) {
    console.error('Failed to fetch period settings:', error);
    const stored = localStorage.getItem('almostadult_period_settings');
    return stored ? JSON.parse(stored) : {
      averageCycleLength: 28,
      averagePeriodLength: 5,
      notifyDaysBefore: 2,
    };
  }
}

export async function savePeriodSettings(settings: PeriodSettings): Promise<void> {
  try {
    await api('periods/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    localStorage.setItem('almostadult_period_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save period settings:', error);
  }
}

// ============ USER SETTINGS (Module Configuration) ============
const DEFAULT_ENABLED_MODULES: ModuleType[] = ['todos', 'shopping', 'workout', 'period'];

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
