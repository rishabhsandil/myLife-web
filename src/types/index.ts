export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  date: string;
  time?: string;
  priority: Priority;
  category?: string;
  recurrence: RecurrenceType;
  completedDates?: string[];
  excludedDates?: string[];
  isEvent?: boolean;
  createdAt: string;
  originalDate?: string; // Original date before being moved forward
  overdue?: boolean; // Whether this task is overdue
  sortOrder?: number; // For manual drag-drop reordering
  ownerId?: string; // User who created the task
  ownerName?: string;
  ownerEmail?: string;
  assignedToUserId?: string; // User assigned to complete the task
  assigneeName?: string;
  assigneeEmail?: string;
  backlogMonth?: string; // YYYY-MM format for backlog organization
}

export type Priority = 'low' | 'medium' | 'high';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

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

export interface PeriodCycle {
  id: string;
  startDate: string;
  endDate?: string; // null if currently ongoing
  createdAt: string;
}

export interface PeriodSettings {
  averageCycleLength: number; // days, default 28
  averagePeriodLength: number; // days, default 5
  notifyDaysBefore: number; // days before predicted period, default 2
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

export type ModuleType = 'todos' | 'shopping' | 'workout' | 'period' | 'notes';

export interface ModuleConfig {
  id: ModuleType;
  name: string;
  description: string;
  enabled: boolean;
}

export interface UserSettings {
  enabledModules: ModuleType[];
}
