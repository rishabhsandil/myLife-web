import { useState, useMemo } from 'react';
import {
  IoBarbell, IoTrash, IoTime, IoFlame, IoCalendar, IoPlay,
  IoCheckmarkCircle, IoChevronBack, IoChevronForward,
} from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
import { BodyPart, WeightUnit, WorkoutSession } from '../../types';
import { formatDuration, getSessionStats, getBodyPartColor } from './helpers';
import { Modal } from '../../components';
import { EmptyState } from '../../components';
import { useModal } from '../../hooks';
import { colors } from '../../utils/theme';

interface SwipeableHistoryCardProps {
  session: WorkoutSession;
  bodyPartColor: string;
  onDelete: () => void;
  onClick: () => void;
}

function SwipeableHistoryCard({ session, bodyPartColor, onDelete, onClick }: SwipeableHistoryCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const resetSwipe = () => {
    setSwipeOffset(0);
    setIsSwiping(false);
  };

  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left') {
        const offset = Math.min(0, Math.max(-100, eventData.deltaX));
        setSwipeOffset(offset);
        setIsSwiping(true);
      }
    },
    onSwiped: (eventData) => {
      if (eventData.dir === 'Left' && swipeOffset < -70) {
        onDelete();
        setTimeout(resetSwipe, 300);
      } else {
        resetSwipe();
      }
      setIsSwiping(false);
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const contentStyle = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const st = getSessionStats(session);
  const date = new Date(session.startTime);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="history-card-wrapper">
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div className="history-card" style={contentStyle} {...swipeHandlers} onClick={onClick}>
        <div className="history-card-header">
          <div
            className="history-split-badge"
            style={{ background: bodyPartColor + '20', color: bodyPartColor }}
          >
            {session.bodyPartName}
          </div>
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
    </div>
  );
}

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
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.

  const bpColor = (partId: string) => getBodyPartColor(bodyParts, partId, colors.primary);

  // Get the start of the week for display
  const getWeekDays = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + offset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return day;
    });
  };

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    sessions.forEach(session => {
      const date = new Date(session.startTime);
      const dateKey = date.toISOString().split('T')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(session);
    });
    return map;
  }, [sessions]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getMonthYearLabel = () => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return `${firstDay.toLocaleDateString('en-US', { month: 'short' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

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
          <>
            {/* Week Calendar View */}
            <div className="week-calendar">
              <div className="week-calendar-header">
                <button className="week-nav-btn" onClick={() => setWeekOffset(weekOffset - 1)}>
                  <IoChevronBack size={18} />
                </button>
                <span className="week-month-label">{getMonthYearLabel()}</span>
                <button className="week-nav-btn" onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0}>
                  <IoChevronForward size={18} />
                </button>
              </div>
              <div className="week-days-grid">
                {weekDays.map((day, index) => {
                  const dateKey = day.toISOString().split('T')[0];
                  const daySessions = sessionsByDate.get(dateKey) || [];
                  const hasWorkout = daySessions.length > 0;
                  const isCurrentDay = isToday(day);
                  const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = day.getDate();

                  return (
                    <div
                      key={index}
                      className={`week-day ${hasWorkout ? 'has-workout' : ''} ${isCurrentDay ? 'today' : ''}`}
                    >
                      <div className="week-day-name">{dayName}</div>
                      <div className="week-day-num">{dayNum}</div>
                      {hasWorkout && (
                        <div className="workout-indicators">
                          {daySessions.map((session) => (
                            <div
                              key={session.id}
                              className="workout-dot"
                              style={{ background: bpColor(session.bodyPartId) }}
                              title={session.bodyPartName}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="history-list">
              {sessions.map(session => (
                <SwipeableHistoryCard
                  key={session.id}
                  session={session}
                  bodyPartColor={bpColor(session.bodyPartId)}
                  onDelete={() => onDeleteSession(session.id)}
                  onClick={() => detailModal.open(session)}
                />
              ))}
            </div>
          </>
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
