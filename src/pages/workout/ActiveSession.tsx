import { useState, useEffect, useRef, useCallback } from 'react';
import {
  IoCheckmark, IoEllipseOutline, IoTime,
  IoChevronDown, IoChevronUp, IoClose, IoBarbell,
} from 'react-icons/io5';
import { Exercise, WeightUnit, WorkoutSession } from '../../types';
import { saveActiveWorkoutSession } from '../../utils/storage';
import { formatTimer, kgToLbs, lbsToKg, getSessionStats } from './helpers';

interface ActiveSessionProps {
  session: WorkoutSession;
  exercises: Exercise[];
  bodyPartColor: string;
  weightUnit: WeightUnit;
  displayWeight: (kg: number) => string;
  onFinish: (session: WorkoutSession, durationSeconds: number) => void;
  onDiscard: () => void;
  onViewPlan: () => void;
  onSessionUpdate: (session: WorkoutSession) => void;
}

export function ActiveSession({
  session: initialSession,
  exercises,
  bodyPartColor,
  weightUnit,
  displayWeight,
  onFinish,
  onDiscard,
  onViewPlan,
  onSessionUpdate,
}: ActiveSessionProps) {
  const [session, setSession] = useState<WorkoutSession>(initialSession);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(
    initialSession.exercises.length > 0 ? initialSession.exercises[0].exerciseId : null
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate initial elapsed
  useEffect(() => {
    const startMs = new Date(session.startTime).getTime();
    setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
  }, []);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const startMs = new Date(session.startTime).getTime();
      setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session.startTime]);

  const updateSession = useCallback((updater: (s: WorkoutSession) => WorkoutSession) => {
    setSession(prev => {
      const updated = updater(prev);
      saveActiveWorkoutSession(updated);
      onSessionUpdate(updated);
      return updated;
    });
  }, [onSessionUpdate]);

  const toggleSetCompleted = (exerciseId: string, setNumber: number) => {
    updateSession(s => ({
      ...s,
      exercises: s.exercises.map(ex => {
        if (ex.exerciseId !== exerciseId) return ex;
        const updatedSets = ex.sets.map(set =>
          set.setNumber === setNumber ? { ...set, completed: !set.completed } : set
        );
        return { ...ex, sets: updatedSets, completed: updatedSets.every(set => set.completed) };
      }),
    }));
  };

  const updateSetReps = (exerciseId: string, setNumber: number, reps: number) => {
    updateSession(s => ({
      ...s,
      exercises: s.exercises.map(ex => {
        if (ex.exerciseId !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map(set =>
            set.setNumber === setNumber ? { ...set, actualReps: Math.max(0, reps) } : set
          ),
        };
      }),
    }));
  };

  const updateSetWeight = (exerciseId: string, setNumber: number, weight: number) => {
    updateSession(s => ({
      ...s,
      exercises: s.exercises.map(ex => {
        if (ex.exerciseId !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map(set =>
            set.setNumber === setNumber ? { ...set, weight: Math.max(0, weight) } : set
          ),
        };
      }),
    }));
  };

  const stats = getSessionStats(session);
  const progressPercent = stats.totalSets > 0 ? (stats.completedSets / stats.totalSets) * 100 : 0;

  return (
    <div className="workout-page active-session-page">
      {/* Session Header */}
      <header className="session-header" style={{ background: `linear-gradient(135deg, ${bodyPartColor}, ${bodyPartColor}dd)` }}>
        <div className="session-header-top">
          <div className="session-header-left">
            <button className="session-discard-btn" onClick={onDiscard} title="Discard workout">
              <IoClose size={20} />
            </button>
            <button className="session-view-plan-btn" onClick={onViewPlan} title="View workout plan">
              <IoBarbell size={18} />
            </button>
          </div>
          <div className="session-split-label">{session.bodyPartName}</div>
          <button className="session-finish-btn" onClick={() => onFinish(session, elapsedSeconds)}>
            <IoCheckmark size={20} />
            <span>Finish</span>
          </button>
        </div>
        <div className="session-timer">
          <IoTime size={20} />
          <span className="timer-value">{formatTimer(elapsedSeconds)}</span>
        </div>
        <div className="session-progress-bar">
          <div className="session-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="session-stats-row">
          <div className="session-stat">
            <span className="stat-number">{stats.completedSets}/{stats.totalSets}</span>
            <span className="stat-label">Sets</span>
          </div>
          <div className="session-stat">
            <span className="stat-number">{stats.completedExercises}/{stats.totalExercises}</span>
            <span className="stat-label">Exercises</span>
          </div>
        </div>
      </header>

      {/* Exercise Checklist */}
      <div className="session-exercises-container">
        {session.exercises.map((sessionEx) => {
          const isExpanded = expandedExercise === sessionEx.exerciseId;
          const exerciseDef = exercises.find(e => e.id === sessionEx.exerciseId);
          const completedSetCount = sessionEx.sets.filter(s => s.completed).length;

          return (
            <div
              key={sessionEx.exerciseId}
              className={`session-exercise-card ${sessionEx.completed ? 'completed' : ''}`}
            >
              <div
                className="session-exercise-header"
                onClick={() => setExpandedExercise(isExpanded ? null : sessionEx.exerciseId)}
              >
                <div className="session-exercise-status" style={{ borderColor: bodyPartColor, background: sessionEx.completed ? bodyPartColor : 'transparent' }}>
                  {sessionEx.completed && <IoCheckmark size={14} color="white" />}
                </div>
                <div className="session-exercise-info">
                  <span className="session-exercise-name">{sessionEx.exerciseName}</span>
                  <span className="session-exercise-meta">
                    {completedSetCount}/{sessionEx.sets.length} sets
                    {exerciseDef && exerciseDef.weight > 0 && (
                      <> · PR: {displayWeight(exerciseDef.weight)} {weightUnit}</>
                    )}
                  </span>
                </div>
                <div className="session-exercise-toggle">
                  {isExpanded ? <IoChevronUp size={18} /> : <IoChevronDown size={18} />}
                </div>
              </div>

              {isExpanded && (
                <div className="session-sets-container">
                  <div className="session-sets-header">
                    <span className="set-col">Set</span>
                    <span className="reps-col">Reps</span>
                    <span className="weight-col">{weightUnit}</span>
                    <span className="check-col"></span>
                  </div>
                  {sessionEx.sets.map((set) => (
                    <div key={set.setNumber} className={`session-set-row ${set.completed ? 'set-done' : ''}`}>
                      <span className="set-col set-number">{set.setNumber}</span>
                      <div className="reps-col">
                        <input
                          type="number"
                          className="set-input"
                          value={set.actualReps}
                          onChange={e => updateSetReps(sessionEx.exerciseId, set.setNumber, parseInt(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          min={0}
                        />
                      </div>
                      <div className="weight-col">
                        <input
                          type="number"
                          className="set-input"
                          value={weightUnit === 'lbs' ? Number(kgToLbs(set.weight).toFixed(1)) : Number(set.weight.toFixed(1))}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            updateSetWeight(sessionEx.exerciseId, set.setNumber, weightUnit === 'lbs' ? lbsToKg(val) : val);
                          }}
                          onFocus={e => e.target.select()}
                          min={0}
                          step={2.5}
                        />
                      </div>
                      <div className="check-col">
                        <button
                          className={`set-check-btn ${set.completed ? 'checked' : ''}`}
                          style={{
                            background: set.completed ? bodyPartColor : 'transparent',
                            borderColor: set.completed ? bodyPartColor : '#D1D5DB'
                          }}
                          onClick={() => toggleSetCompleted(sessionEx.exerciseId, set.setNumber)}
                        >
                          {set.completed ? <IoCheckmark size={16} color="white" /> : <IoEllipseOutline size={16} color="#D1D5DB" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
