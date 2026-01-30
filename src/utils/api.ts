import { TodoItem, ShoppingItem, Exercise, WorkoutSession } from '../types';

// API base URL - empty for same origin (Vercel), or set for local dev
const API_BASE = import.meta.env.VITE_API_URL || '';

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

// Helper for API calls
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

// ============ TODOS ============

export async function getTodos(): Promise<TodoItem[]> {
  try {
    return await api<TodoItem[]>('todos');
  } catch (error) {
    console.error('Failed to fetch todos:', error);
    // Fallback to localStorage
    const data = localStorage.getItem('mylife_todos');
    return data ? JSON.parse(data) : [];
  }
}

export async function saveTodo(todo: TodoItem): Promise<void> {
  try {
    await api('todos', {
      method: 'POST',
      body: JSON.stringify(todo),
    });
  } catch (error) {
    console.error('Failed to save todo:', error);
  }
}

export async function updateTodo(todo: TodoItem): Promise<void> {
  try {
    await api('todos', {
      method: 'PUT',
      body: JSON.stringify(todo),
    });
  } catch (error) {
    console.error('Failed to update todo:', error);
  }
}

export async function deleteTodo(id: string): Promise<void> {
  try {
    await api(`todos?id=${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to delete todo:', error);
  }
}

// Batch save (for compatibility)
export async function saveTodos(todos: TodoItem[]): Promise<void> {
  // For now, save to localStorage as backup
  localStorage.setItem('mylife_todos', JSON.stringify(todos));
}

// ============ SHOPPING ============

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  try {
    return await api<ShoppingItem[]>('shopping');
  } catch (error) {
    console.error('Failed to fetch shopping items:', error);
    const data = localStorage.getItem('mylife_shopping');
    return data ? JSON.parse(data) : [];
  }
}

export async function saveShoppingItem(item: ShoppingItem): Promise<void> {
  try {
    await api('shopping', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  } catch (error) {
    console.error('Failed to save shopping item:', error);
  }
}

export async function updateShoppingItem(item: ShoppingItem): Promise<void> {
  try {
    await api('shopping', {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  } catch (error) {
    console.error('Failed to update shopping item:', error);
  }
}

export async function deleteShoppingItem(id: string): Promise<void> {
  try {
    await api(`shopping?id=${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to delete shopping item:', error);
  }
}

export async function clearCompletedItems(): Promise<void> {
  try {
    await api('shopping?clearCompleted=true', { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to clear completed items:', error);
  }
}

export async function saveShoppingItems(items: ShoppingItem[]): Promise<void> {
  localStorage.setItem('mylife_shopping', JSON.stringify(items));
}

// ============ EXERCISES ============

export async function getExercises(): Promise<Exercise[]> {
  try {
    return await api<Exercise[]>('exercises');
  } catch (error) {
    console.error('Failed to fetch exercises:', error);
    const data = localStorage.getItem('mylife_exercises');
    return data ? JSON.parse(data) : [];
  }
}

export async function saveExercise(exercise: Exercise): Promise<void> {
  try {
    await api('exercises', {
      method: 'POST',
      body: JSON.stringify(exercise),
    });
  } catch (error) {
    console.error('Failed to save exercise:', error);
  }
}

export async function updateExercise(exercise: Exercise): Promise<void> {
  try {
    await api('exercises', {
      method: 'PUT',
      body: JSON.stringify(exercise),
    });
  } catch (error) {
    console.error('Failed to update exercise:', error);
  }
}

export async function deleteExercise(id: string): Promise<void> {
  try {
    await api(`exercises?id=${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to delete exercise:', error);
  }
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  localStorage.setItem('mylife_exercises', JSON.stringify(exercises));
}

// ============ WORKOUTS ============

export async function getWorkoutSessions(): Promise<WorkoutSession[]> {
  try {
    return await api<WorkoutSession[]>('workouts');
  } catch (error) {
    console.error('Failed to fetch workouts:', error);
    const data = localStorage.getItem('mylife_workouts');
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
    console.error('Failed to save workout:', error);
  }
}

export async function saveWorkoutSessions(sessions: WorkoutSession[]): Promise<void> {
  localStorage.setItem('mylife_workouts', JSON.stringify(sessions));
}

// ============ BACKUP ============

export const exportBackup = async (): Promise<void> => {
  const [todos, shopping, exercises, workouts] = await Promise.all([
    getTodos(),
    getShoppingItems(),
    getExercises(),
    getWorkoutSessions(),
  ]);

  const backupData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    data: { todos, shopping, exercises, workouts },
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
          // Save to localStorage as backup
          localStorage.setItem('mylife_todos', JSON.stringify(data.data.todos || []));
          localStorage.setItem('mylife_shopping', JSON.stringify(data.data.shopping || []));
          localStorage.setItem('mylife_exercises', JSON.stringify(data.data.exercises || []));
          localStorage.setItem('mylife_workouts', JSON.stringify(data.data.workouts || []));
          
          // TODO: Sync to database
          // For now, page refresh will load from localStorage if API fails
          
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
