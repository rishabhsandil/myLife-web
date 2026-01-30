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
}

export type ShoppingCategory = 'groceries' | 'household' | 'personal' | 'other';

export interface Exercise {
  id: string;
  name: string;
  bodyPart: BodyPart;
  personalRecord?: number;
}

export type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

export interface WorkoutSession {
  id: string;
  date: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface WorkoutSet {
  reps: number;
  weight: number;
}
