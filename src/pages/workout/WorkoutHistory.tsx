import {
  IoBarbell, IoTrash, IoTime, IoFlame, IoCalendar, IoPlay,
  IoCheckmarkCircle,
} from 'react-icons/io5';
import { BodyPart, WeightUnit, WorkoutSession } from '../../types';
import { formatDuration, getSessionStats, getBodyPartColor } from './helpers';
import { Modal } from '../../components';
import { EmptyState } from '../../components';
import { useModal } from '../../hooks';
import { colors } from '../../utils/theme';

interface WorkoutHistoryProps {
  sessions: WorkoutSession[];
  bodyParts: BodyPart[];
  weightUnit: WeightUnit;
  displayWeight: (kg: number) => string;
  onDeleteSession: (id: string) => void;
  onStartWorkout: () => void;
}

export function WorkoutHistory({
  sessions,
  bodyParts,
  weightUnit,
  displayWeight,
  onDeleteSession,
  onStartWorkout,
}: WorkoutHistoryProps) {
  const detailModal = useModal<WorkoutSession>();

  const bpColor = (partId: string) => getBodyPartColor(bodyParts, partId, colors.primary);

  return (
    <>
      <div className="history-container">
        {sessions.length === 0 ? (
          <EmptyState
            icon={IoCalendar}
            message="No workout sessions yet"
            action={{ label: 'Start Workout', icon: IoPlay, onClick: onStartWorkout }}
          />
        ) : (
          <div className="history-list">
            {sessions.map(session => {
              const st = getSessionStats(session);
              const date = new Date(session.startTime);
              const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              return (
                <div key={session.id} className="history-card" onClick={() => detailModal.open(session)}>
                  <div className="history-card-header">
                    <div
                      className="history-split-badge"
                      style={{ background: bpColor(session.bodyPartId) + '20', color: bpColor(session.bodyPartId) }}
                    >
                      {session.bodyPartName}
                    </div>
                    <button
                      className="history-delete-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                    >
                      <IoTrash size={14} />
                    </button>
                  </div>
                  <div className="history-card-date">
                    {dateStr} · {timeStr}
                  </div>
                  <div className="history-card-stats">
                    <span><IoFlame size={12} /> {st.completedExercises} exercises</span>
                    <span><IoBarbell size={12} /> {st.completedSets} sets</span>
                    {(session.duration ?? 0) > 0 && (
                      <span><IoTime size={12} /> {formatDuration(session.duration || 0)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History Detail Modal */}
      <Modal
        isOpen={detailModal.isOpen}
        onClose={detailModal.close}
        title="Workout Details"
        className="history-detail-modal"
        footer={<button className="btn secondary" onClick={detailModal.close}>Close</button>}
      >
        {detailModal.data && (() => {
          const s = getSessionStats(detailModal.data);
          const session = detailModal.data;
          const date = new Date(session.startTime);
          return (
            <div className="summary-content">
              <div className="summary-hero">
                <div
                  className="history-split-badge large"
                  style={{ background: bpColor(session.bodyPartId) + '20', color: bpColor(session.bodyPartId) }}
                >
                  {session.bodyPartName}
                </div>
                <span className="summary-date">
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {(session.duration ?? 0) > 0 && (
                  <span className="summary-duration">
                    <IoTime size={16} /> {formatDuration(session.duration || 0)}
                  </span>
                )}
              </div>
              <div className="summary-stats-grid">
                <div className="summary-stat-card">
                  <span className="summary-stat-value">{s.completedExercises}</span>
                  <span className="summary-stat-label">Exercises</span>
                </div>
                <div className="summary-stat-card">
                  <span className="summary-stat-value">{s.completedSets}</span>
                  <span className="summary-stat-label">Sets</span>
                </div>
              </div>
              <div className="summary-exercises-list">
                {session.exercises.map(ex => {
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
                })}
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
