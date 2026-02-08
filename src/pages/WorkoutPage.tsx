import { useState, useEffect } from 'react';
import {
  IoAdd, IoBarbell, IoTrophy, IoTrash, IoPencil, IoSettings, IoReorderTwo
} from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Exercise, BodyPart, WeightUnit } from '../types';
import { 
  getExercises, saveExercise, updateExercise, deleteExercise as apiDeleteExercise,
  getBodyParts, saveBodyPart, updateBodyPart, deleteBodyPart as apiDeleteBodyPart
} from '../utils/api.ts';
import { getWeightUnit, saveWeightUnit } from '../utils/storage.ts';
import { Modal, ModalFooter, FormGroup, FormRow, NumberControl, ColorPicker, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import './WorkoutPage.css';

// Sortable Exercise Item Component
interface SortableExerciseItemProps {
  exercise: Exercise;
  bodyPartColor: string;
  weightUnit: WeightUnit;
  displayWeight: (kg: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableExerciseItem({ exercise, bodyPartColor, weightUnit, displayWeight, onEdit, onDelete }: SortableExerciseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: exercise.id });

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
        // Call delete and reset immediately - modal will handle confirmation
        onDelete();
        // Reset after a short delay to allow modal to open
        setTimeout(resetSwipe, 300);
      } else {
        resetSwipe();
      }
      setIsSwiping(false);
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSwiping ? 'none' : transition,
  };

  const contentStyle = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="exercise-card"
    >
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div className="exercise-card-content" style={contentStyle} {...swipeHandlers}>
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
        >
          <IoReorderTwo size={20} color={colors.textMuted} />
        </button>
        <div className="exercise-content" onClick={onEdit}>
        <div
          className="exercise-icon"
          style={{ background: bodyPartColor + '20', color: bodyPartColor }}
        >
          <IoBarbell size={18} />
        </div>
        <div className="exercise-info">
          <span className="exercise-name">{exercise.name}</span>
          <div className="exercise-details">
            <span className="exercise-stats">
              {exercise.sets} sets × {exercise.reps} reps
            </span>
            {exercise.weight > 0 && (
              <span className="exercise-pr">
                <IoTrophy size={11} /> {displayWeight(exercise.weight)} {weightUnit}
              </span>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function WorkoutPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  
  const exerciseModal = useModal<Exercise>();
  const settingsModal = useModal();
  const deleteModal = useModal<Exercise>();

  // Exercise form state
  const [exerciseName, setExerciseName] = useState('');
  const [formSets, setFormSets] = useState(3);
  const [formReps, setFormReps] = useState(10);
  const [formWeight, setFormWeight] = useState(0);

  // Body part form state
  const [editingBodyPart, setEditingBodyPart] = useState<BodyPart | null>(null);
  const [bpName, setBpName] = useState('');
  const [bpColor, setBpColor] = useState('#ef4444');

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
    // Load weight unit preference
    const savedUnit = getWeightUnit();
    setWeightUnit(savedUnit);
  }, []);

  async function loadData() {
    setIsLoading(true);
    const [exerciseData, bodyPartData] = await Promise.all([
      getExercises(),
      getBodyParts()
    ]);
    setExercises(exerciseData);
    setBodyParts(bodyPartData);
    if (bodyPartData.length > 0 && !selectedBodyPart) {
      setSelectedBodyPart(bodyPartData[0].id);
    }
    setIsLoading(false);
  }

  const currentBodyPart = bodyParts.find(bp => bp.id === selectedBodyPart);
  const filteredExercises = exercises
    .filter(e => e.bodyPart === selectedBodyPart)
    .sort((a, b) => {
      // Sort by sortOrder if available
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder;
      }
      if (a.sortOrder !== undefined) return -1;
      if (b.sortOrder !== undefined) return 1;
      // Default order
      return 0;
    });

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
    // Convert weight to current unit for display
    const displayWeightValue = weightUnit === 'lbs' ? kgToLbs(exercise.weight) : exercise.weight;
    setFormWeight(Number(displayWeightValue.toFixed(1)));
    exerciseModal.open(exercise);
  };

  const handleSave = async () => {
    if (!exerciseName.trim()) return;

    // Convert weight to kg for storage if currently in lbs
    const weightInKg = weightUnit === 'lbs' ? lbsToKg(formWeight) : formWeight;

    if (exerciseModal.data) {
      // Update existing
      const updated: Exercise = {
        ...exerciseModal.data,
        name: exerciseName.trim(),
        sets: formSets,
        reps: formReps,
        weight: weightInKg,
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
        weight: weightInKg,
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredExercises.findIndex((ex) => ex.id === active.id);
      const newIndex = filteredExercises.findIndex((ex) => ex.id === over.id);

      const reorderedExercises = arrayMove(filteredExercises, oldIndex, newIndex);
      
      // Assign sortOrder to all exercises in this body part
      const updatedExercises = reorderedExercises.map((ex, index) => ({
        ...ex,
        sortOrder: index,
      }));

      // Optimistically update UI
      setExercises(exercises.map(e => {
        const updatedEx = updatedExercises.find(ue => ue.id === e.id);
        return updatedEx || e;
      }));

      // Update all reordered exercises in backend
      for (const ex of updatedExercises) {
        await updateExercise(ex);
      }
    }
  };

  const getBodyPartColor = (partId: string) => {
    return bodyParts.find(b => b.id === partId)?.color || colors.primary;
  };

  // Weight conversion helpers
  const kgToLbs = (kg: number): number => kg * 2.20462;
  const lbsToKg = (lbs: number): number => lbs / 2.20462;
  
  const displayWeight = (kg: number): string => {
    if (weightUnit === 'lbs') {
      return kgToLbs(kg).toFixed(1);
    }
    return kg.toFixed(1);
  };

  const handleWeightUnitChange = (unit: WeightUnit) => {
    setWeightUnit(unit);
    saveWeightUnit(unit);
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
    setBpColor('#ef4444');
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
        </div>
      )}

      <div className="exercises-container">
        {isLoading ? (
          <div className="exercises-list">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-item">
                <div className="skeleton-row">
                  <div className="skeleton skeleton-circle" style={{ width: '40px', height: '40px' }}></div>
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text large" style={{ width: '65%' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '45%' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : bodyParts.length === 0 ? (
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredExercises.map(e => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="exercises-list">
                {filteredExercises.map(exercise => (
                  <SortableExerciseItem
                    key={exercise.id}
                    exercise={exercise}
                    bodyPartColor={getBodyPartColor(exercise.bodyPart)}
                    weightUnit={weightUnit}
                    displayWeight={displayWeight}
                    onEdit={() => openEditModal(exercise)}
                    onDelete={() => deleteModal.open(exercise)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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

        <FormGroup label={`PR Weight (${weightUnit})`}>
          <input
            type="number"
            value={formWeight === 0 ? '' : formWeight}
            onChange={e => setFormWeight(Number(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            placeholder="0"
            min="0"
            step="2.5"
          />
        </FormGroup>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Exercise"
        footer={
          <ModalFooter
            onCancel={deleteModal.close}
            onSubmit={() => {
              if (deleteModal.data) {
                handleDeleteExercise(deleteModal.data.id);
                deleteModal.close();
              }
            }}
            submitText="Delete"
            cancelText="Cancel"
            submitDestructive
          />
        }
      >
        <p>Are you sure you want to delete "{deleteModal.data?.name}"?</p>
      </Modal>

      {/* Settings Modal - Manage Body Parts */}
      <Modal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
        title="Workout Splits"
        className="settings-modal"
        footer={<button className="btn secondary" onClick={settingsModal.close}>Done</button>}
      >
        {/* Weight Unit Toggle */}
        <div className="weight-unit-toggle">
          <label className="setting-label">Weight Unit</label>
          <div className="unit-buttons">
            <button
              className={`unit-btn ${weightUnit === 'kg' ? 'active' : ''}`}
              onClick={() => handleWeightUnitChange('kg')}
            >
              kg
            </button>
            <button
              className={`unit-btn ${weightUnit === 'lbs' ? 'active' : ''}`}
              onClick={() => handleWeightUnitChange('lbs')}
            >
              lbs
            </button>
          </div>
        </div>

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
                  <ColorPicker value={bpColor} onChange={setBpColor} />
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
            <ColorPicker value={bpColor} onChange={setBpColor} />
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
