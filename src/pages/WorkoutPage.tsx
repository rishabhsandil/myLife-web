import { useState, useEffect } from 'react';
import {
  IoAdd, IoBarbell, IoTrophy, IoTrash, IoPencil, IoSettings
} from 'react-icons/io5';
import { Exercise, BodyPart } from '../types';
import { 
  getExercises, saveExercise, updateExercise, deleteExercise as apiDeleteExercise,
  getBodyParts, saveBodyPart, updateBodyPart, deleteBodyPart as apiDeleteBodyPart
} from '../utils/api.ts';
import { Modal, ModalFooter, FormGroup, FormRow, NumberControl, ColorPicker, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import './WorkoutPage.css';

const COLOR_OPTIONS = [
  '#EF4444', '#F59E0B', '#22C55E', '#14B8A6', 
  '#6366F1', '#EC4899', '#8B5CF6', '#64748B'
];

export default function WorkoutPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  
  const exerciseModal = useModal<Exercise>();
  const settingsModal = useModal();

  // Exercise form state
  const [exerciseName, setExerciseName] = useState('');
  const [formSets, setFormSets] = useState(3);
  const [formReps, setFormReps] = useState(10);
  const [formWeight, setFormWeight] = useState(0);

  // Body part form state
  const [editingBodyPart, setEditingBodyPart] = useState<BodyPart | null>(null);
  const [bpName, setBpName] = useState('');
  const [bpColor, setBpColor] = useState(COLOR_OPTIONS[0]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [exerciseData, bodyPartData] = await Promise.all([
      getExercises(),
      getBodyParts()
    ]);
    setExercises(exerciseData);
    setBodyParts(bodyPartData);
    if (bodyPartData.length > 0 && !selectedBodyPart) {
      setSelectedBodyPart(bodyPartData[0].id);
    }
  }

  const currentBodyPart = bodyParts.find(bp => bp.id === selectedBodyPart);
  const filteredExercises = exercises.filter(e => e.bodyPart === selectedBodyPart);

  const resetExerciseForm = () => {
    setExerciseName('');
    setFormSets(3);
    setFormReps(10);
    setFormWeight(0);
  };

  const openAddModal = () => {
    resetExerciseForm();
    exerciseModal.open();
  };

  const openEditModal = (exercise: Exercise) => {
    setExerciseName(exercise.name);
    setFormSets(exercise.sets);
    setFormReps(exercise.reps);
    setFormWeight(exercise.weight);
    exerciseModal.open(exercise);
  };

  const handleSave = async () => {
    if (!exerciseName.trim()) return;

    if (exerciseModal.data) {
      // Update existing
      const updated: Exercise = {
        ...exerciseModal.data,
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

    exerciseModal.close();
  };

  const handleDeleteExercise = async (id: string) => {
    await apiDeleteExercise(id);
    setExercises(exercises.filter(e => e.id !== id));
  };

  const getBodyPartColor = (partId: string) => {
    return bodyParts.find(b => b.id === partId)?.color || colors.primary;
  };

  // Body part management
  const openEditBodyPart = (bp: BodyPart) => {
    setEditingBodyPart(bp);
    setBpName(bp.name);
    setBpColor(bp.color);
  };

  const resetBodyPartForm = () => {
    setEditingBodyPart(null);
    setBpName('');
    setBpColor(COLOR_OPTIONS[0]);
  };

  const handleSaveBodyPart = async () => {
    if (!bpName.trim()) return;

    if (editingBodyPart) {
      const updated: BodyPart = { ...editingBodyPart, name: bpName.trim(), color: bpColor };
      await updateBodyPart(updated);
      setBodyParts(bodyParts.map(bp => bp.id === updated.id ? updated : bp));
    } else {
      const newBp: BodyPart = {
        id: `bp_${Date.now()}`,
        name: bpName.trim(),
        color: bpColor,
      };
      await saveBodyPart(newBp);
      setBodyParts([...bodyParts, newBp]);
      if (!selectedBodyPart) {
        setSelectedBodyPart(newBp.id);
      }
    }

    resetBodyPartForm();
  };

  const handleDeleteBodyPart = async (id: string) => {
    await apiDeleteBodyPart(id);
    setBodyParts(bodyParts.filter(bp => bp.id !== id));
    setExercises(exercises.filter(e => e.bodyPart !== id));
    if (selectedBodyPart === id) {
      const remaining = bodyParts.filter(bp => bp.id !== id);
      setSelectedBodyPart(remaining.length > 0 ? remaining[0].id : '');
    }
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
        <button className="settings-btn" onClick={() => settingsModal.open()}>
          <IoSettings size={22} />
        </button>
      </header>

      {/* Body Part Tabs */}
      <div className="body-parts">
        {bodyParts.map(part => (
          <button
            key={part.id}
            className={`body-part-btn ${selectedBodyPart === part.id ? 'active' : ''}`}
            style={{ '--part-color': part.color } as React.CSSProperties}
            onClick={() => setSelectedBodyPart(part.id)}
          >
            {part.name}
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
        {bodyParts.length === 0 ? (
          <EmptyState
            icon={IoSettings}
            message="No workout splits configured"
            action={{ label: 'Configure Splits', icon: IoSettings, onClick: () => settingsModal.open() }}
          />
        ) : filteredExercises.length === 0 ? (
          <EmptyState
            icon={IoBarbell}
            message={`No exercises for ${currentBodyPart?.name || 'this split'}`}
            action={{ label: 'Add Exercise', icon: IoAdd, onClick: openAddModal }}
          />
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
      {bodyParts.length > 0 && <FAB onClick={openAddModal} />}

      {/* Add/Edit Exercise Modal */}
      <Modal
        isOpen={exerciseModal.isOpen}
        onClose={exerciseModal.close}
        title={exerciseModal.data ? 'Edit Exercise' : 'Add Exercise'}
        footer={
          <ModalFooter
            onCancel={exerciseModal.close}
            onSubmit={handleSave}
            submitText={exerciseModal.data ? 'Save Changes' : 'Add Exercise'}
            submitDisabled={!exerciseName.trim()}
          />
        }
      >
        <FormGroup label="Exercise Name">
          <input
            type="text"
            value={exerciseName}
            onChange={e => setExerciseName(e.target.value)}
            placeholder="e.g., Bench Press"
            autoFocus
          />
        </FormGroup>

        <FormRow>
          <FormGroup label="Sets">
            <NumberControl value={formSets} onChange={setFormSets} min={1} />
          </FormGroup>
          <FormGroup label="Reps">
            <NumberControl value={formReps} onChange={setFormReps} min={1} />
          </FormGroup>
        </FormRow>

        <FormGroup label="PR Weight (kg)">
          <input
            type="number"
            value={formWeight}
            onChange={e => setFormWeight(Number(e.target.value))}
            placeholder="0"
            min="0"
            step="2.5"
          />
        </FormGroup>
      </Modal>

      {/* Settings Modal - Manage Body Parts */}
      <Modal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
        title="Workout Splits"
        className="settings-modal"
        footer={<button className="btn secondary" onClick={settingsModal.close}>Done</button>}
      >
        {/* Existing body parts */}
        <div className="body-parts-list">
          {bodyParts.map(bp => (
            <div key={bp.id} className="body-part-item">
              <div className="body-part-color" style={{ background: bp.color }} />
              {editingBodyPart?.id === bp.id ? (
                <>
                  <input
                    type="text"
                    value={bpName}
                    onChange={e => setBpName(e.target.value)}
                    className="body-part-input"
                    autoFocus
                  />
                  <ColorPicker colors={COLOR_OPTIONS} value={bpColor} onChange={setBpColor} />
                  <button className="save-bp-btn" onClick={handleSaveBodyPart}>Save</button>
                  <button className="cancel-bp-btn" onClick={resetBodyPartForm}>✕</button>
                </>
              ) : (
                <>
                  <span className="body-part-name">{bp.name}</span>
                  <span className="body-part-exercise-count">
                    {exercises.filter(e => e.bodyPart === bp.id).length} exercises
                  </span>
                  <button className="edit-bp-btn" onClick={() => openEditBodyPart(bp)}>
                    <IoPencil size={16} />
                  </button>
                  <button className="delete-bp-btn" onClick={() => handleDeleteBodyPart(bp.id)}>
                    <IoTrash size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new body part */}
        {!editingBodyPart && (
          <div className="add-body-part">
            <input
              type="text"
              value={bpName}
              onChange={e => setBpName(e.target.value)}
              placeholder="New split name (e.g., Push)"
              className="body-part-input"
            />
            <ColorPicker colors={COLOR_OPTIONS} value={bpColor} onChange={setBpColor} />
            <button 
              className="btn primary add-bp-btn" 
              onClick={handleSaveBodyPart}
              disabled={!bpName.trim()}
            >
              <IoAdd size={18} /> Add Split
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
