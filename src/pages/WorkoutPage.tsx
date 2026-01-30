import { useState, useEffect } from 'react';
import {
  IoAdd, IoClose, IoFitness, IoBarbell, IoTrophy, IoTrash,
  IoChevronForward
} from 'react-icons/io5';
import { Exercise, BodyPart, WorkoutSession, WorkoutExercise, WorkoutSet } from '../types';
import { getExercises, saveExercise, updateExercise, deleteExercise as apiDeleteExercise, getWorkoutSessions, saveWorkoutSession } from '../utils/api';
import { colors } from '../utils/theme';
import './WorkoutPage.css';

const BODY_PARTS: { key: BodyPart; label: string; color: string }[] = [
  { key: 'chest', label: 'Chest', color: '#EF4444' },
  { key: 'back', label: 'Back', color: '#6366F1' },
  { key: 'shoulders', label: 'Shoulders', color: '#F59E0B' },
  { key: 'arms', label: 'Arms', color: '#22C55E' },
  { key: 'legs', label: 'Legs', color: '#EC4899' },
  { key: 'core', label: 'Core', color: '#14B8A6' },
];

export default function WorkoutPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart>('chest');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  // Form state
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState<WorkoutSet[]>([{ reps: 10, weight: 0 }]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [exerciseData, sessionData] = await Promise.all([
      getExercises(),
      getWorkoutSessions()
    ]);
    setExercises(exerciseData);
    setSessions(sessionData);
  }

  const filteredExercises = exercises.filter(e => e.bodyPart === selectedBodyPart);

  const handleAddExercise = async () => {
    if (!exerciseName.trim()) return;

    const newExercise: Exercise = {
      id: Date.now().toString(),
      name: exerciseName.trim(),
      bodyPart: selectedBodyPart,
    };

    await saveExercise(newExercise);
    setExercises([...exercises, newExercise]);
    setExerciseName('');
    setShowAddExercise(false);
  };

  const handleDeleteExercise = async (id: string) => {
    await apiDeleteExercise(id);
    setExercises(exercises.filter(e => e.id !== id));
  };

  const startWorkout = (exercise: Exercise) => {
    setActiveExercise(exercise);
    setSets([{ reps: 10, weight: 0 }]);
    setShowWorkoutModal(true);
  };

  const addSet = () => {
    const lastSet = sets[sets.length - 1];
    setSets([...sets, { ...lastSet }]);
  };

  const removeSet = (index: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== index));
    }
  };

  const updateSet = (index: number, field: 'reps' | 'weight', value: number) => {
    const newSets = sets.map((set, i) =>
      i === index ? { ...set, [field]: value } : set
    );
    setSets(newSets);
  };

  const saveWorkoutHandler = async () => {
    if (!activeExercise) return;

    const today = new Date().toISOString().split('T')[0];
    let session = sessions.find(s => s.date === today);

    const workoutExercise: WorkoutExercise = {
      exerciseId: activeExercise.id,
      sets: sets,
    };

    let isNewSession = false;
    if (session) {
      const existingIndex = session.exercises.findIndex(e => e.exerciseId === activeExercise.id);
      if (existingIndex >= 0) {
        session = { ...session, exercises: session.exercises.map((e, i) => i === existingIndex ? workoutExercise : e) };
      } else {
        session = { ...session, exercises: [...session.exercises, workoutExercise] };
      }
    } else {
      isNewSession = true;
      session = {
        id: Date.now().toString(),
        date: today,
        exercises: [workoutExercise],
      };
    }

    await saveWorkoutSession(session);
    
    if (isNewSession) {
      setSessions([...sessions, session]);
    } else {
      setSessions(sessions.map(s => s.date === today ? session! : s));
    }

    // Update PR if applicable
    const maxWeight = Math.max(...sets.map(s => s.weight));
    if (!activeExercise.personalRecord || maxWeight > activeExercise.personalRecord) {
      const updatedExercise = { ...activeExercise, personalRecord: maxWeight };
      await updateExercise(updatedExercise);
      setExercises(exercises.map(e => e.id === activeExercise.id ? updatedExercise : e));
    }

    setShowWorkoutModal(false);
    setActiveExercise(null);
  };

  const getTodayStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const session = sessions.find(s => s.date === today);
    if (!session) return { exercises: 0, sets: 0, volume: 0 };

    let totalSets = 0;
    let totalVolume = 0;
    session.exercises.forEach(e => {
      totalSets += e.sets.length;
      e.sets.forEach(s => {
        totalVolume += s.weight * s.reps;
      });
    });

    return {
      exercises: session.exercises.length,
      sets: totalSets,
      volume: totalVolume,
    };
  };

  const stats = getTodayStats();

  const getBodyPartColor = (part: BodyPart) => {
    return BODY_PARTS.find(b => b.key === part)?.color || colors.primary;
  };

  return (
    <div className="workout-page">
      {/* Header */}
      <header className="workout-header">
        <div>
          <h1 className="header-title">Workout</h1>
          <p className="header-subtitle">Track your gains 💪</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <IoFitness size={20} color={colors.primary} />
          <span className="stat-value">{stats.exercises}</span>
          <span className="stat-label">Exercises</span>
        </div>
        <div className="stat-card">
          <IoBarbell size={20} color={colors.accent} />
          <span className="stat-value">{stats.sets}</span>
          <span className="stat-label">Sets</span>
        </div>
        <div className="stat-card">
          <IoTrophy size={20} color={colors.warning} />
          <span className="stat-value">{stats.volume > 1000 ? `${(stats.volume / 1000).toFixed(1)}k` : stats.volume}</span>
          <span className="stat-label">Volume</span>
        </div>
      </div>

      {/* Body Part Tabs */}
      <div className="body-parts">
        {BODY_PARTS.map(part => (
          <button
            key={part.key}
            className={`body-part-btn ${selectedBodyPart === part.key ? 'active' : ''}`}
            style={{ '--part-color': part.color } as React.CSSProperties}
            onClick={() => setSelectedBodyPart(part.key)}
          >
            {part.label}
          </button>
        ))}
      </div>

      {/* Exercises List */}
      <div className="exercises-container">
        {filteredExercises.length === 0 ? (
          <div className="empty-state">
            <IoBarbell size={48} color={colors.textMuted} />
            <p>No exercises for {selectedBodyPart}</p>
            <button className="add-exercise-btn" onClick={() => setShowAddExercise(true)}>
              <IoAdd size={20} /> Add Exercise
            </button>
          </div>
        ) : (
          <div className="exercises-list">
            {filteredExercises.map(exercise => (
              <div key={exercise.id} className="exercise-card">
                <div className="exercise-content" onClick={() => startWorkout(exercise)}>
                  <div
                    className="exercise-icon"
                    style={{ background: getBodyPartColor(exercise.bodyPart) + '20', color: getBodyPartColor(exercise.bodyPart) }}
                  >
                    <IoBarbell size={20} />
                  </div>
                  <div className="exercise-info">
                    <span className="exercise-name">{exercise.name}</span>
                    {exercise.personalRecord && (
                      <span className="exercise-pr">
                        <IoTrophy size={12} /> PR: {exercise.personalRecord}kg
                      </span>
                    )}
                  </div>
                  <IoChevronForward size={20} color={colors.textMuted} />
                </div>
                <button className="exercise-delete" onClick={() => handleDeleteExercise(exercise.id)}>
                  <IoTrash size={16} color={colors.error} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddExercise(true)}>
        <IoAdd size={28} />
      </button>

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <div className="modal-overlay" onClick={() => setShowAddExercise(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Exercise</h2>
              <button onClick={() => setShowAddExercise(false)}>
                <IoClose size={24} color={colors.textSecondary} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Exercise Name</label>
                <input
                  type="text"
                  value={exerciseName}
                  onChange={e => setExerciseName(e.target.value)}
                  placeholder="e.g., Bench Press"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Body Part: <strong style={{ color: getBodyPartColor(selectedBodyPart) }}>{selectedBodyPart}</strong></label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowAddExercise(false)}>Cancel</button>
              <button className="btn primary" onClick={handleAddExercise} disabled={!exerciseName.trim()}>
                Add Exercise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout Modal */}
      {showWorkoutModal && activeExercise && (
        <div className="modal-overlay" onClick={() => setShowWorkoutModal(false)}>
          <div className="modal-content workout-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{activeExercise.name}</h2>
              <button onClick={() => setShowWorkoutModal(false)}>
                <IoClose size={24} color={colors.textSecondary} />
              </button>
            </div>

            <div className="modal-body">
              {activeExercise.personalRecord && (
                <div className="pr-banner">
                  <IoTrophy size={16} /> Personal Record: {activeExercise.personalRecord}kg
                </div>
              )}

              <div className="sets-header">
                <span>Set</span>
                <span>Weight (kg)</span>
                <span>Reps</span>
                <span></span>
              </div>

              {sets.map((set, index) => (
                <div key={index} className="set-row">
                  <span className="set-num">{index + 1}</span>
                  <input
                    type="number"
                    value={set.weight}
                    onChange={e => updateSet(index, 'weight', Number(e.target.value))}
                    min="0"
                  />
                  <input
                    type="number"
                    value={set.reps}
                    onChange={e => updateSet(index, 'reps', Number(e.target.value))}
                    min="1"
                  />
                  <button className="remove-set" onClick={() => removeSet(index)}>
                    <IoClose size={16} />
                  </button>
                </div>
              ))}

              <button className="add-set-btn" onClick={addSet}>
                <IoAdd size={18} /> Add Set
              </button>
            </div>

            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowWorkoutModal(false)}>Cancel</button>
              <button className="btn primary" onClick={saveWorkoutHandler}>
                Save Workout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
