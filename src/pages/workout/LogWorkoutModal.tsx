import { useState, useMemo } from 'react';
import {
  IoCheckmark, IoEllipseOutline, IoAdd, IoRemove,
  IoChevronDown, IoChevronUp,
} from 'react-icons/io5';
import { BodyPart, Exercise, WeightUnit, WorkoutSession, WorkoutSessionExercise } from '../../types';
import { Modal, ModalFooter, FormGroup } from '../../components';
import { kgToLbs, lbsToKg, buildSessionExercises } from './helpers';
import { colors } from '../../utils/theme';

interface LogWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bodyParts: BodyPart[];
  exercises: Exercise[];
  weightUnit: WeightUnit;
  onSave: (session: WorkoutSession) => void;
}

export function LogWorkoutModal({
  isOpen,
  onClose,
  bodyParts,
  exercises,
  weightUnit,
  onSave,
}: LogWorkoutModalProps) {
  const [step, setStep] = useState<'details' | 'exercises'>('details');
  const [selectedBodyPartId, setSelectedBodyPartId] = useState('');
  const [workoutDate, setWorkoutDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });
  const [workoutTime, setWorkoutTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [sessionExercises, setSessionExercises] = useState<WorkoutSessionExercise[]>([]);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const selectedBodyPart = bodyParts.find(bp => bp.id === selectedBodyPartId);
  const bpColor = selectedBodyPart?.color || colors.primary;

  const bpExerciseCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const bp of bodyParts) {
      map[bp.id] = exercises.filter(e => e.bodyPart === bp.id).length;
    }
    return map;
  }, [bodyParts, exercises]);

  const reset = () => {
    setStep('details');
    setSelectedBodyPartId('');
    const d = new Date();
    setWorkoutDate(d.toISOString().slice(0, 10));
    setWorkoutTime('09:00');
    setDurationMinutes(60);
    setSessionExercises([]);
    setExpandedExercise(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleNextStep = () => {
    if (!selectedBodyPartId) return;
    const builtExercises = buildSessionExercises(exercises, selectedBodyPartId);
    // Mark all sets as completed by default for backfill
    const withCompleted = builtExercises.map(ex => ({
      ...ex,
      completed: true,
      sets: ex.sets.map(s => ({ ...s, completed: true })),
    }));
    setSessionExercises(withCompleted);
    if (withCompleted.length > 0) {
      setExpandedExercise(withCompleted[0].exerciseId);
    }
    setStep('exercises');
  };

  const handleBack = () => {
    setStep('details');
  };

  const toggleSetCompleted = (exerciseId: string, setNumber: number) => {
    setSessionExercises(prev => prev.map(ex => {
      if (ex.exerciseId !== exerciseId) return ex;
      const updatedSets = ex.sets.map(s =>
        s.setNumber === setNumber ? { ...s, completed: !s.completed } : s
      );
      return { ...ex, sets: updatedSets, completed: updatedSets.every(s => s.completed) };
    }));
  };

  const updateSetReps = (exerciseId: string, setNumber: number, reps: number) => {
    setSessionExercises(prev => prev.map(ex => {
      if (ex.exerciseId !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s =>
          s.setNumber === setNumber ? { ...s, actualReps: Math.max(0, reps) } : s
        ),
      };
    }));
  };

  const updateSetWeight = (exerciseId: string, setNumber: number, weight: number) => {
    setSessionExercises(prev => prev.map(ex => {
      if (ex.exerciseId !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s =>
          s.setNumber === setNumber ? { ...s, weight: Math.max(0, weight) } : s
        ),
      };
    }));
  };

  const handleSave = () => {
    if (!selectedBodyPartId || !selectedBodyPart) return;

    const [year, month, day] = workoutDate.split('-').map(Number);
    const [hours, minutes] = workoutTime.split(':').map(Number);
    const startDate = new Date(year, month - 1, day, hours, minutes);

    const session: WorkoutSession = {
      id: `ws_${Date.now()}`,
      bodyPartId: selectedBodyPartId,
      bodyPartName: selectedBodyPart.name,
      date: workoutDate,
      startTime: startDate.toISOString(),
      endTime: new Date(startDate.getTime() + durationMinutes * 60000).toISOString(),
      duration: durationMinutes * 60,
      exercises: sessionExercises,
      createdAt: new Date().toISOString(),
    };

    onSave(session);
    handleClose();
  };

  const hasCompletedSets = sessionExercises.some(ex => ex.sets.some(s => s.completed));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Log Past Workout"
      className="log-workout-modal"
      footer={
        step === 'details' ? (
          <ModalFooter
            onCancel={handleClose}
            onSubmit={handleNextStep}
            submitText="Next"
            submitDisabled={!selectedBodyPartId}
          />
        ) : (
          <ModalFooter
            onCancel={handleBack}
            onSubmit={handleSave}
            cancelText="Back"
            submitText="Save Workout"
            submitDisabled={!hasCompletedSets}
          />
        )
      }
    >
      {step === 'details' ? (
        <div className="log-workout-details">
          <FormGroup label="Date">
            <input
              type="date"
              value={workoutDate}
              onChange={e => setWorkoutDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </FormGroup>

          <FormGroup label="Time">
            <input
              type="time"
              value={workoutTime}
              onChange={e => setWorkoutTime(e.target.value)}
            />
          </FormGroup>

          <FormGroup label={`Duration (${durationMinutes} min)`}>
            <div className="duration-control">
              <button
                className="duration-btn"
                onClick={() => setDurationMinutes(Math.max(5, durationMinutes - 5))}
              >
                <IoRemove size={16} />
              </button>
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                className="duration-slider"
              />
              <button
                className="duration-btn"
                onClick={() => setDurationMinutes(Math.min(180, durationMinutes + 5))}
              >
                <IoAdd size={16} />
              </button>
            </div>
          </FormGroup>

          <FormGroup label="Split">
            <div className="log-split-list">
              {bodyParts.map(bp => {
                const count = bpExerciseCount[bp.id] || 0;
                const isSelected = selectedBodyPartId === bp.id;
                return (
                  <button
                    key={bp.id}
                    className={`log-split-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      borderColor: isSelected ? bp.color : undefined,
                      background: isSelected ? bp.color + '10' : undefined,
                    }}
                    onClick={() => setSelectedBodyPartId(bp.id)}
                    disabled={count === 0}
                  >
                    <div className="split-picker-color" style={{ background: bp.color }} />
                    <div className="split-picker-info">
                      <span className="split-picker-name">{bp.name}</span>
                      <span className="split-picker-count">{count} exercise{count !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </FormGroup>
        </div>
      ) : (
        <div className="log-workout-exercises">
          <p className="log-exercises-hint">
            Adjust sets, reps, and weights. Uncheck any sets you didn't do.
          </p>
          <div className="session-exercises-container compact">
            {sessionExercises.map(sessionEx => {
              const isExpanded = expandedExercise === sessionEx.exerciseId;
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
                    <div
                      className="session-exercise-status"
                      style={{
                        borderColor: bpColor,
                        background: sessionEx.completed ? bpColor : 'transparent',
                      }}
                    >
                      {sessionEx.completed && <IoCheckmark size={14} color="white" />}
                    </div>
                    <div className="session-exercise-info">
                      <span className="session-exercise-name">{sessionEx.exerciseName}</span>
                      <span className="session-exercise-meta">
                        {completedSetCount}/{sessionEx.sets.length} sets
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
                      {sessionEx.sets.map(set => (
                        <div
                          key={set.setNumber}
                          className={`session-set-row ${set.completed ? 'set-done' : ''}`}
                        >
                          <span className="set-col set-number">{set.setNumber}</span>
                          <div className="reps-col">
                            <input
                              type="number"
                              className="set-input"
                              value={set.actualReps}
                              onChange={e =>
                                updateSetReps(
                                  sessionEx.exerciseId,
                                  set.setNumber,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              onFocus={e => e.target.select()}
                              min={0}
                            />
                          </div>
                          <div className="weight-col">
                            <input
                              type="number"
                              className="set-input"
                              value={
                                weightUnit === 'lbs'
                                  ? Number(kgToLbs(set.weight).toFixed(1))
                                  : Number(set.weight.toFixed(1))
                              }
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                updateSetWeight(
                                  sessionEx.exerciseId,
                                  set.setNumber,
                                  weightUnit === 'lbs' ? lbsToKg(val) : val
                                );
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
                                background: set.completed ? bpColor : 'transparent',
                                borderColor: set.completed ? bpColor : '#D1D5DB',
                              }}
                              onClick={() => toggleSetCompleted(sessionEx.exerciseId, set.setNumber)}
                            >
                              {set.completed ? (
                                <IoCheckmark size={16} color="white" />
                              ) : (
                                <IoEllipseOutline size={16} color="#D1D5DB" />
                              )}
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
      )}
    </Modal>
  );
}
