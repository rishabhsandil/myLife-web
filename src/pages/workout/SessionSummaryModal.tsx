import {
  IoTrophy, IoTime, IoCheckmarkCircle,
} from 'react-icons/io5';
import { WeightUnit, WorkoutSession } from '../../types';
import { formatDuration, getSessionStats } from './helpers';
import { Modal } from '../../components';

interface SessionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: WorkoutSession | null;
  /** "complete" shows trophy + "Workout Complete! 🎉", "detail" shows split badge + "Workout Details" */
  mode: 'complete' | 'detail';
  bodyPartColor?: string;
  weightUnit: WeightUnit;
  displayWeight: (kg: number) => string;
}

export function SessionSummaryModal({
  isOpen,
  onClose,
  session,
  mode,
  bodyPartColor,
  weightUnit,
  displayWeight,
}: SessionSummaryModalProps) {
  if (!session) return null;

  const stats = getSessionStats(session);
  const date = new Date(session.startTime);
  const isComplete = mode === 'complete';
  const color = bodyPartColor || '#6366F1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isComplete ? 'Workout Complete! 🎉' : 'Workout Details'}
      className={isComplete ? 'summary-modal' : 'history-detail-modal'}
      footer={
        <button className={`btn ${isComplete ? 'primary' : 'secondary'}`} onClick={onClose}>
          {isComplete ? 'Done' : 'Close'}
        </button>
      }
    >
      <div className="summary-content">
        <div className="summary-hero">
          {isComplete ? (
            <>
              <IoTrophy size={40} color="#F59E0B" />
              <h3>{session.bodyPartName}</h3>
            </>
          ) : (
            <>
              <div
                className="history-split-badge large"
                style={{ background: color + '20', color }}
              >
                {session.bodyPartName}
              </div>
              <span className="summary-date">
                {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </>
          )}
          {(session.duration ?? 0) > 0 && (
            <span className="summary-duration">
              <IoTime size={16} /> {formatDuration(session.duration || 0)}
            </span>
          )}
        </div>

        <div className="summary-stats-grid">
          <div className="summary-stat-card">
            <span className="summary-stat-value">{stats.completedExercises}</span>
            <span className="summary-stat-label">Exercises</span>
          </div>
          <div className="summary-stat-card">
            <span className="summary-stat-value">{stats.completedSets}</span>
            <span className="summary-stat-label">Sets</span>
          </div>
        </div>

        <div className="summary-exercises-list">
          {isComplete ? (
            // Compact list for "complete" mode
            session.exercises
              .filter(ex => ex.sets.some(s => s.completed))
              .map(ex => (
                <div key={ex.exerciseId} className="summary-exercise-row">
                  <IoCheckmarkCircle size={16} color="#22C55E" />
                  <span className="summary-ex-name">{ex.exerciseName}</span>
                  <span className="summary-ex-detail">
                    {ex.sets.filter(s => s.completed).length} sets
                  </span>
                </div>
              ))
          ) : (
            // Detailed list for "detail" mode with set info
            session.exercises.map(ex => {
              const completedSets = ex.sets.filter(s => s.completed);
              if (completedSets.length === 0) return null;
              return (
                <div key={ex.exerciseId} className="history-exercise-detail">
                  <div className="history-exercise-header-row">
                    <IoCheckmarkCircle size={16} color="#22C55E" />
                    <span className="summary-ex-name">{ex.exerciseName}</span>
                  </div>
                  <div className="history-sets-list">
                    {completedSets.map(set => (
                      <div key={set.setNumber} className="history-set-row">
                        <span className="history-set-num">Set {set.setNumber}</span>
                        <span>{set.actualReps} reps</span>
                        <span>{displayWeight(set.weight)} {weightUnit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
