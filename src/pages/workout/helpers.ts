import { WorkoutSession, WorkoutSessionExercise, Exercise, BodyPart, WeightUnit } from '../../types';

// Format seconds to MM:SS or HH:MM:SS
export function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Format duration for history display
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

// Weight conversion helpers
export const kgToLbs = (kg: number): number => kg * 2.20462;
export const lbsToKg = (lbs: number): number => lbs / 2.20462;

export const makeDisplayWeight = (weightUnit: WeightUnit) => (kg: number): string => {
  if (weightUnit === 'lbs') return kgToLbs(kg).toFixed(1);
  return kg.toFixed(1);
};

// Computed stats for a session
export interface SessionStats {
  totalSets: number;
  completedSets: number;
  completedExercises: number;
  totalExercises: number;
}

export function getSessionStats(session: WorkoutSession): SessionStats {
  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0
  );
  const completedExercises = session.exercises.filter(ex => ex.completed).length;
  const totalExercises = session.exercises.length;
  return { totalSets, completedSets, completedExercises, totalExercises };
}

// Build session exercises from exercise definitions
export function buildSessionExercises(
  exercises: Exercise[],
  bodyPartId: string
): WorkoutSessionExercise[] {
  return exercises
    .filter(e => e.bodyPart === bodyPartId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(ex => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      completed: false,
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        targetReps: ex.reps,
        actualReps: ex.reps,
        weight: ex.weight,
        completed: false,
      })),
    }));
}

// Get body part color
export function getBodyPartColor(bodyParts: BodyPart[], partId: string, fallback: string): string {
  return bodyParts.find(b => b.id === partId)?.color || fallback;
}
