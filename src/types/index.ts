export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  date: string;
  time?: string;
  priority: Priority;
  recurrence: RecurrenceType;
  completedDates?: string[];
  excludedDates?: string[];
  isEvent?: boolean;
  createdAt: string;
}

export type Priority = 'low' | 'medium' | 'high';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  category: ShoppingCategory;
  completed: boolean;
  createdAt: string;
  ownerId?: string;
  ownerName?: string;
  isOwn?: boolean;
}

export type ShoppingCategory = 'freshco' | 'costco' | 'amazon' | 'other';

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
}

export interface BodyPart {
  id: string;
  name: string;
  color: string;
}
