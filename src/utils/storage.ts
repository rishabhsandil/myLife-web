import { TodoItem, ShoppingItem, Exercise, WeightUnit } from '../types';

const STORAGE_KEYS = {
  TODOS: 'almostadult_todos',
  SHOPPING: 'almostadult_shopping',
  EXERCISES: 'almostadult_exercises',
  LAST_BACKUP: 'almostadult_last_backup',
  WEIGHT_UNIT: 'almostadult_weight_unit',
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

// Backup functions
export const exportBackup = (): void => {
  const backupData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    data: {
      todos: getTodos(),
      shopping: getShoppingItems(),
      exercises: getExercises(),
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
