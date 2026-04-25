import { useReducer } from 'react';
import { WorkoutSession } from '../../types';
import { getActiveWorkoutSession } from '../../utils/storage';

/**
 * Session lifecycle state machine for `WorkoutPage`.
 *
 * Replaces three previously-scattered pieces of state:
 *   - `activeSession: WorkoutSession | null`
 *   - `showingPlanDuringSession: boolean`
 *   - `summaryModal` (a `useModal<WorkoutSession>` whose only trigger was
 *     `handleFinishWorkout`)
 *
 * Storage side-effects (`saveActiveWorkoutSession` / `clearActiveWorkoutSession`)
 * stay at the call sites — the reducer is pure.
 */
export type SessionState =
  | { status: 'idle' }
  | { status: 'active'; session: WorkoutSession; viewingPlan: boolean }
  | { status: 'summary'; session: WorkoutSession };

export type SessionAction =
  | { type: 'start'; session: WorkoutSession }
  | { type: 'update'; session: WorkoutSession }
  | { type: 'viewPlan' }
  | { type: 'resume' }
  | { type: 'finish'; session: WorkoutSession }
  | { type: 'discard' }
  | { type: 'closeSummary' };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'start':
      return { status: 'active', session: action.session, viewingPlan: false };
    case 'update':
      // Only meaningful while a session is in progress; ignore otherwise.
      if (state.status !== 'active') return state;
      return { ...state, session: action.session };
    case 'viewPlan':
      if (state.status !== 'active') return state;
      return { ...state, viewingPlan: true };
    case 'resume':
      if (state.status !== 'active') return state;
      return { ...state, viewingPlan: false };
    case 'finish':
      return { status: 'summary', session: action.session };
    case 'discard':
      return { status: 'idle' };
    case 'closeSummary':
      return state.status === 'summary' ? { status: 'idle' } : state;
    default:
      return state;
  }
}

/** Lazy initializer — restores any in-progress session from localStorage on mount. */
function initSessionState(): SessionState {
  const saved = getActiveWorkoutSession();
  return saved ? { status: 'active', session: saved, viewingPlan: false } : { status: 'idle' };
}

export function useSessionMachine() {
  return useReducer(sessionReducer, undefined, initSessionState);
}
