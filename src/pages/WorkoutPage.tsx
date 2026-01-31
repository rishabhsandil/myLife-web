import { useState, useEffect } from 'react';
import {
  IoAdd, IoClose, IoBarbell, IoTrophy, IoTrash, IoPencil
} from 'react-icons/io5';
import { Exercise, BodyPart } from '../types';
import { getExercises, saveExercise, updateExercise, deleteExercise as apiDeleteExercise } from '../utils/api';
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
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart>('chest');
  const [showModal, setShowModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Form state
  const [exerciseName, setExerciseName] = useState('');
  const [formSets, setFormSets] = useState(3);
  const [formReps, setFormReps] = useState(10);
  const [formWeight, setFormWeight] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const exerciseData = await getExercises();
    setExercises(exerciseData);
  }

  const filteredExercises = exercises.filter(e => e.bodyPart === selectedBodyPart);

  const openAddModal = () => {
    setEditingExercise(null);
    setExerciseName('');
    setFormSets(3);
    setFormReps(10);
    setFormWeight(0);
    setShowModal(true);
  };

  const openEditModal = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setExerciseName(exercise.name);
    setFormSets(exercise.sets);
    setFormReps(exercise.reps);
    setFormWeight(exercise.weight);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!exerciseName.trim()) return;

    if (editingExercise) {
      // Update existing
      const updated: Exercise = {
        ...editingExercise,
        name: exerciseName.trim(),
        sets: formSets,
        reps: formReps,
        weight: formWeight,
      };
      await updateExercise(updated);
      setExercises(exercises.map(e => e.id === updated.id ? updated : e));
    } else {
      // Add new
      const newExercise: Exercise = {
        id: Date.now().toString(),
        name: exerciseName.trim(),
        bodyPart: selectedBodyPart,
        sets: formSets,
        reps: formReps,
        weight: formWeight,
      };
      await saveExercise(newExercise);
      setExercises([...exercises, newExercise]);
    }

    setShowModal(false);
    setEditingExercise(null);
  };

  const handleDeleteExercise = async (id: string) => {
    await apiDeleteExercise(id);
    setExercises(exercises.filter(e => e.id !== id));
  };

  const getBodyPartColor = (part: BodyPart) => {
    return BODY_PARTS.find(b => b.key === part)?.color || colors.primary;
  };

  const getTotalVolume = () => {
    return filteredExercises.reduce((sum, e) => sum + (e.sets * e.reps * e.weight), 0);
  };

  return (
    <div className="workout-page">
      {/* Header */}
      <header className="workout-header">
        <div>
          <h1 className="header-title">Workout Plan</h1>
          <p className="header-subtitle">Your exercises & PRs 💪</p>
        </div>
      </header>

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
            <span className="body-part-count">
              {exercises.filter(e => e.bodyPart === part.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Summary */}
      {filteredExercises.length > 0 && (
        <div className="workout-summary">
          <span>{filteredExercises.length} exercises</span>
          <span>•</span>
          <span>Total volume: {getTotalVolume() > 1000 ? `${(getTotalVolume() / 1000).toFixed(1)}k` : getTotalVolume()} kg</span>
        </div>
      )}

      {/* Exercises List */}
      <div className="exercises-container">
        {filteredExercises.length === 0 ? (
          <div className="empty-state">
            <IoBarbell size={48} color={colors.textMuted} />
            <p>No exercises for {selectedBodyPart}</p>
            <button className="add-exercise-btn" onClick={openAddModal}>
              <IoAdd size={20} /> Add Exercise
            </button>
          </div>
        ) : (
          <div className="exercises-list">
            {filteredExercises.map(exercise => (
              <div key={exercise.id} className="exercise-card">
                <div className="exercise-content" onClick={() => openEditModal(exercise)}>
                  <div
                    className="exercise-icon"
                    style={{ background: getBodyPartColor(exercise.bodyPart) + '20', color: getBodyPartColor(exercise.bodyPart) }}
                  >
                    <IoBarbell size={20} />
                  </div>
                  <div className="exercise-info">
                    <span className="exercise-name">{exercise.name}</span>
                    <div className="exercise-details">
                      <span className="exercise-stats">
                        {exercise.sets} sets × {exercise.reps} reps
                      </span>
                      {exercise.weight > 0 && (
                        <span className="exercise-pr">
                          <IoTrophy size={12} /> {exercise.weight} kg
                        </span>
                      )}
                    </div>
                  </div>
                  <IoPencil size={18} color={colors.textMuted} />
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
      <button className="fab" onClick={openAddModal}>
        <IoAdd size={28} />
      </button>

      {/* Add/Edit Exercise Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingExercise ? 'Edit Exercise' : 'Add Exercise'}</h2>
              <button onClick={() => setShowModal(false)}>
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
                <label>Body Part</label>
                <span className="body-part-label" style={{ color: getBodyPartColor(selectedBodyPart) }}>
                  {BODY_PARTS.find(b => b.key === selectedBodyPart)?.label}
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Sets</label>
                  <div className="number-control">
                    <button onClick={() => setFormSets(Math.max(1, formSets - 1))}>-</button>
                    <span>{formSets}</span>
                    <button onClick={() => setFormSets(formSets + 1)}>+</button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Reps</label>
                  <div className="number-control">
                    <button onClick={() => setFormReps(Math.max(1, formReps - 1))}>-</button>
                    <span>{formReps}</span>
                    <button onClick={() => setFormReps(formReps + 1)}>+</button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>PR Weight (kg)</label>
                <input
                  type="number"
                  value={formWeight}
                  onChange={e => setFormWeight(Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  step="2.5"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleSave} disabled={!exerciseName.trim()}>
                {editingExercise ? 'Save Changes' : 'Add Exercise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
