import { TodoItem, ShoppingItem, Exercise, BodyPart, ShoppingShareStatus, ShoppingShareUser, ShoppingAuditEntry } from '../types';

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
const todosApi = createCrudApi<TodoItem>('todos', 'mylife_todos');
const shoppingApi = createCrudApi<ShoppingItem>('shopping', 'mylife_shopping');
const exercisesApi = createCrudApi<Exercise>('exercises', 'mylife_exercises');
const bodyPartsApi = createCrudApi<BodyPart>('bodyparts', 'mylife_bodyparts');

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

export async function clearCompletedItems(): Promise<void> {
  try {
    await api('shopping?clearCompleted=true', { method: 'DELETE' });
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

// ============ BACKUP ============
export const exportBackup = async (): Promise<void> => {
  const [todos, shopping, exercises] = await Promise.all([
    getTodos(),
    getShoppingItems(),
    getExercises(),
  ]);

  const backupData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    data: { todos, shopping, exercises },
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mylife_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importBackup = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.version && data.data) {
          localStorage.setItem('mylife_todos', JSON.stringify(data.data.todos || []));
          localStorage.setItem('mylife_shopping', JSON.stringify(data.data.shopping || []));
          localStorage.setItem('mylife_exercises', JSON.stringify(data.data.exercises || []));
          resolve(true);
        } else {
          resolve(false);
        }
      } catch {
        resolve(false);
      }
    };
    reader.readAsText(file);
  });
};
