export type Priority = 'low' | 'medium' | 'high';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

/**
 * Fields shared by every todo regardless of recurrence.
 *
 * Assignment fields (`assignedToUserId`, `assigneeName`, `assigneeEmail`) are
 * orthogonal to recurrence — a recurring task can also be assigned — so
 * assignment lives on the base rather than as its own union arm. The union
 * discriminates only on `recurrence` because that's what controls whether the
 * row's completion state lives in `completed` (one-shot) or in
 * `completedDates`/`excludedDates` (per-occurrence).
 */
interface TodoBase {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  date: string;
  time?: string;
  priority: Priority;
  category?: string;
  isEvent?: boolean;
  createdAt: string;
  sortOrder?: number; // For manual drag-drop reordering
  ownerId?: string; // User who created the task
  ownerName?: string;
  ownerEmail?: string;
  assignedToUserId?: string; // User assigned to complete the task
  assigneeName?: string;
  assigneeEmail?: string;
  backlogMonth?: string; // YYYY-MM format for backlog organization
}

/** A one-shot todo. `completed` toggles the whole task. */
export interface BasicTodo extends TodoBase {
  recurrence: 'none';
  originalDate?: string; // Original date before being carried forward
  overdue?: boolean;
}

/** A repeating todo. Completion is tracked per-date via `completedDates`. */
export interface RecurringTodo extends TodoBase {
  recurrence: Exclude<RecurrenceType, 'none'>;
  completedDates: string[];
  excludedDates: string[];
  recurrenceDays?: number[]; // Days of week for custom recurrence (0=Sun..6=Sat)
}

export type TodoItem = BasicTodo | RecurringTodo;

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  storeId: string; // Reference to ShoppingStore
  storeName?: string; // Store name for filtering when sharing
  completed: boolean;
  createdAt: string;
  ownerId?: string;
  ownerName?: string;
  isOwn?: boolean;
  sortOrder?: number; // For manual drag-drop reordering
}

export interface ShoppingStore {
  id: string;
  name: string;
  color: string;
}

// Legacy type for backwards compatibility
export type ShoppingCategory = string;

export interface ShoppingShareUser {
  id: string;
  email: string;
  name: string;
  sharedAt?: string;
}

export interface ShoppingShareStatus {
  sharedWith: ShoppingShareUser[];
  sharedBy: ShoppingShareUser[];
}

export interface ShoppingAuditEntry {
  id: string;
  action: 'added' | 'completed' | 'uncompleted' | 'deleted' | 'cleared';
  itemName: string;
  details?: string;
  userName: string;
  createdAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string; // User-configurable body part ID
  sets: number;
  reps: number;
  weight: number; // PR weight
  sortOrder?: number; // For manual drag-drop reordering
}

export interface BodyPart {
  id: string;
  name: string;
  color: string;
}

export type WeightUnit = 'kg' | 'lbs';

// Workout Session Tracking
export interface WorkoutSession {
  id: string;
  bodyPartId: string;
  bodyPartName: string;
  date: string; // YYYY-MM-DD format
  startTime: string;
  endTime?: string;
  duration?: number; // seconds
  exercises: WorkoutSessionExercise[];
  createdAt: string;
}

export interface WorkoutSessionExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetLog[];
  completed: boolean;
}

export interface WorkoutSetLog {
  setNumber: number;
  targetReps: number;
  actualReps: number;
  weight: number; // in kg always
  completed: boolean;
}


export interface Note {
  id: string;
  title: string;
  content: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  sortOrder?: number; // For manual drag-drop reordering
}

export type ModuleType = 'todos' | 'shopping' | 'workout' | 'notes' | 'recipes';

export interface ModuleConfig {
  id: ModuleType;
  name: string;
  description: string;
  enabled: boolean;
}

// ============ RECIPES ============
export interface RecipeIngredient {
  amount?: string;
  unit?: string;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  prepTime?: number;   // minutes
  cookTime?: number;   // minutes
  servings?: number;
  tags?: string[];
  sourceUrl?: string;
  sourcePlatform?: 'youtube' | 'manual';
  thumbnail?: string;
  channelName?: string;
  isFavorite?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SharedRecipe extends Recipe {
  sharedByName: string;
  sharedAt: string;
}

export interface UserSettings {
  enabledModules: ModuleType[];
}
