import { TodoItem, ShoppingItem, Exercise, WeightUnit, Note, WorkoutSession } from '../types';

const STORAGE_KEYS = {
  TODOS: 'almostadult_todos',
  SHOPPING: 'almostadult_shopping',
  EXERCISES: 'almostadult_exercises',
  LAST_BACKUP: 'almostadult_last_backup',
  WEIGHT_UNIT: 'almostadult_weight_unit',
  NOTES: 'almostadult_notes',
};

// Todos
export const getTodos = (): TodoItem[] => {
  const data = localStorage.getItem(STORAGE_KEYS.TODOS);
  return data ? JSON.parse(data) : [];
};

export const saveTodos = (todos: TodoItem[]): void => {
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
};

// Shopping
export const getShoppingItems = (): ShoppingItem[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SHOPPING);
  return data ? JSON.parse(data) : [];
};

export const saveShoppingItems = (items: ShoppingItem[]): void => {
  localStorage.setItem(STORAGE_KEYS.SHOPPING, JSON.stringify(items));
};

// Exercises
export const getExercises = (): Exercise[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXERCISES);
  return data ? JSON.parse(data) : [];
};

export const saveExercises = (exercises: Exercise[]): void => {
  localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
};

// Weight unit
export const getWeightUnit = (): WeightUnit => {
  const unit = localStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT);
  return (unit as WeightUnit) || 'kg';
};

export const saveWeightUnit = (unit: WeightUnit): void => {
  localStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, unit);
};

// Notes
export const getNotes = (): Note[] => {
  const data = localStorage.getItem(STORAGE_KEYS.NOTES);
  return data ? JSON.parse(data) : [];
};

export const saveNotes = (notes: Note[]): void => {
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
};

// Active Workout Session (persisted in localStorage for crash recovery)
const ACTIVE_SESSION_KEY = 'almostadult_active_workout_session';

export const getActiveWorkoutSession = (): WorkoutSession | null => {
  const data = localStorage.getItem(ACTIVE_SESSION_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveActiveWorkoutSession = (session: WorkoutSession): void => {
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
};

export const clearActiveWorkoutSession = (): void => {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
};

// Backup functions
export const exportBackup = (): void => {
  const backupData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    data: {
      todos: getTodos(),
      shopping: getShoppingItems(),
      exercises: getExercises(),
      notes: getNotes(),
    },
  };
  
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `almostadult_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importBackup = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.version && data.data) {
          saveTodos(data.data.todos || []);
          saveShoppingItems(data.data.shopping || []);
          saveExercises(data.data.exercises || []);
          saveNotes(data.data.notes || []);
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
