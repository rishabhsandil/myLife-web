import { useState, useEffect } from 'react';
import {
  IoAdd, IoBarbell, IoSettings, IoPlay, IoCalendar,
  IoTrash, IoPencil,
  IoClipboard,
} from 'react-icons/io5';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Exercise, BodyPart, WeightUnit, WorkoutSession } from '../types';
import {
  getExercises, saveExercise, updateExercise, deleteExercise as apiDeleteExercise,
  getBodyParts, saveBodyPart, updateBodyPart, deleteBodyPart as apiDeleteBodyPart,
  getWorkoutSessions, saveWorkoutSession, deleteWorkoutSession,
} from '../utils/api.ts';
import {
  getWeightUnit, saveWeightUnit, getActiveWorkoutSession, clearActiveWorkoutSession,
  saveActiveWorkoutSession,
} from '../utils/storage.ts';
import { Modal, ModalFooter, FormGroup, FormRow, NumberControl, ColorPicker, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';

import { makeDisplayWeight, kgToLbs, lbsToKg, buildSessionExercises, getBodyPartColor as getBpColor } from './workout/helpers';
import { SortableExerciseItem } from './workout/SortableExerciseItem';
import { ActiveSession } from './workout/ActiveSession';
import { WorkoutHistory } from './workout/WorkoutHistory';
import { SessionSummaryModal } from './workout/SessionSummaryModal';
import { LogWorkoutModal } from './workout/LogWorkoutModal';

import './WorkoutPage.css';

export default function WorkoutPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');

  // Active workout session state
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);

  // Workout history state
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Modals
  const exerciseModal = useModal<Exercise>();
  const settingsModal = useModal();
  const deleteModal = useModal<Exercise>();
  const startWorkoutModal = useModal();
  const summaryModal = useModal<WorkoutSession>();
  const logWorkoutModal = useModal();

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
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const displayWeight = makeDisplayWeight(weightUnit);
  const getBodyPartColor = (partId: string) => getBpColor(bodyParts, partId, colors.primary);

  useEffect(() => {
    loadData();
    const savedUnit = getWeightUnit();
    setWeightUnit(savedUnit);

    // Restore active session from localStorage
    const savedSession = getActiveWorkoutSession();
    if (savedSession) {
      setActiveSession(savedSession);
    }
  }, []);

  async function loadData() {
    setIsLoading(true);
    const [exerciseData, bodyPartData] = await Promise.all([
      getExercises(),
      getBodyParts(),
    ]);
    setExercises(exerciseData);
    setBodyParts(bodyPartData);
    if (bodyPartData.length > 0 && !selectedBodyPart) {
      setSelectedBodyPart(bodyPartData[0].id);
    }
    setIsLoading(false);
  }

  async function loadHistory() {
    const sessions = await getWorkoutSessions();
    setWorkoutHistory(sessions);
  }

  // ---- Derived data ----
  const currentBodyPart = bodyParts.find(bp => bp.id === selectedBodyPart);
  const filteredExercises = exercises
    .filter(e => e.bodyPart === selectedBodyPart)
    .sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
      if (a.sortOrder !== undefined) return -1;
      if (b.sortOrder !== undefined) return 1;
      return 0;
    });

  // ---- Exercise CRUD ----
  const resetExerciseForm = () => {
    setExerciseName('');
    setFormSets(3);
    setFormReps(10);
    setFormWeight(0);
  };

  const openAddModal = () => { resetExerciseForm(); exerciseModal.open(); };

  const openEditModal = (exercise: Exercise) => {
    setExerciseName(exercise.name);
    setFormSets(exercise.sets);
    setFormReps(exercise.reps);
    const displayVal = weightUnit === 'lbs' ? kgToLbs(exercise.weight) : exercise.weight;
    setFormWeight(Number(displayVal.toFixed(1)));
    exerciseModal.open(exercise);
  };

  const handleSave = async () => {
    if (!exerciseName.trim()) return;
    const weightInKg = weightUnit === 'lbs' ? lbsToKg(formWeight) : formWeight;

    if (exerciseModal.data) {
      const updated: Exercise = { ...exerciseModal.data, name: exerciseName.trim(), sets: formSets, reps: formReps, weight: weightInKg };
      await updateExercise(updated);
      setExercises(exercises.map(e => e.id === updated.id ? updated : e));
    } else {
      const newExercise: Exercise = {
        id: Date.now().toString(), name: exerciseName.trim(), bodyPart: selectedBodyPart,
        sets: formSets, reps: formReps, weight: weightInKg,
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
      const oldIndex = filteredExercises.findIndex(ex => ex.id === active.id);
      const newIndex = filteredExercises.findIndex(ex => ex.id === over.id);
      const reordered = arrayMove(filteredExercises, oldIndex, newIndex).map((ex, i) => ({ ...ex, sortOrder: i }));
      setExercises(exercises.map(e => {
        const updated = reordered.find(ue => ue.id === e.id);
        return updated || e;
      }));
      for (const ex of reordered) { await updateExercise(ex); }
    }
  };

  // ---- Weight unit ----
  const handleWeightUnitChange = (unit: WeightUnit) => { setWeightUnit(unit); saveWeightUnit(unit); };

  // ---- Body part management ----
  const openEditBodyPart = (bp: BodyPart) => { setEditingBodyPart(bp); setBpName(bp.name); setBpColor(bp.color); };
  const resetBodyPartForm = () => { setEditingBodyPart(null); setBpName(''); setBpColor('#ef4444'); };

  const handleSaveBodyPart = async () => {
    if (!bpName.trim()) return;
    if (editingBodyPart) {
      const updated: BodyPart = { ...editingBodyPart, name: bpName.trim(), color: bpColor };
      await updateBodyPart(updated);
      setBodyParts(bodyParts.map(bp => bp.id === updated.id ? updated : bp));
    } else {
      const newBp: BodyPart = { id: `bp_${Date.now()}`, name: bpName.trim(), color: bpColor };
      await saveBodyPart(newBp);
      setBodyParts([...bodyParts, newBp]);
      if (!selectedBodyPart) setSelectedBodyPart(newBp.id);
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

  // ============ WORKOUT SESSION LOGIC ============

  const handleStartWorkout = (bodyPartId: string) => {
    const bp = bodyParts.find(b => b.id === bodyPartId);
    if (!bp) return;

    const sessionExercises = buildSessionExercises(exercises, bodyPartId);
    const session: WorkoutSession = {
      id: `ws_${Date.now()}`,
      bodyPartId: bp.id,
      bodyPartName: bp.name,
      startTime: new Date().toISOString(),
      exercises: sessionExercises,
      createdAt: new Date().toISOString(),
    };

    setActiveSession(session);
    saveActiveWorkoutSession(session);
    startWorkoutModal.close();
  };

  const handleFinishWorkout = async (session: WorkoutSession, duration: number) => {
    const completedSession: WorkoutSession = {
      ...session,
      endTime: new Date().toISOString(),
      duration,
    };

    await saveWorkoutSession(completedSession);

    // Update PRs
    for (const sessionEx of completedSession.exercises) {
      const exercise = exercises.find(e => e.id === sessionEx.exerciseId);
      if (!exercise) continue;
      const maxWeight = Math.max(...sessionEx.sets.filter(s => s.completed).map(s => s.weight), 0);
      if (maxWeight > exercise.weight) {
        const updated = { ...exercise, weight: maxWeight };
        await updateExercise(updated);
        setExercises(prev => prev.map(e => e.id === updated.id ? updated : e));
      }
    }

    clearActiveWorkoutSession();
    setActiveSession(null);
    summaryModal.open(completedSession);
  };

  const handleDiscardWorkout = () => {
    clearActiveWorkoutSession();
    setActiveSession(null);
  };

  const handleToggleHistory = async () => {
    if (!showHistory) { await loadHistory(); }
    setShowHistory(!showHistory);
  };

  const handleDeleteSession = async (id: string) => {
    await deleteWorkoutSession(id);
    setWorkoutHistory(prev => prev.filter(s => s.id !== id));
  };

  const handleLogWorkout = async (session: WorkoutSession) => {
    await saveWorkoutSession(session);

    // Update PRs from logged workout
    for (const sessionEx of session.exercises) {
      const exercise = exercises.find(e => e.id === sessionEx.exerciseId);
      if (!exercise) continue;
      const maxWeight = Math.max(...sessionEx.sets.filter(s => s.completed).map(s => s.weight), 0);
      if (maxWeight > exercise.weight) {
        const updated = { ...exercise, weight: maxWeight };
        await updateExercise(updated);
        setExercises(prev => prev.map(e => e.id === updated.id ? updated : e));
      }
    }

    // Refresh history if visible
    if (showHistory) { await loadHistory(); }
  };

  // ============ RENDER: ACTIVE SESSION ============
  if (activeSession) {
    return (
      <>
        <ActiveSession
          session={activeSession}
          exercises={exercises}
          bodyPartColor={getBodyPartColor(activeSession.bodyPartId)}
          weightUnit={weightUnit}
          displayWeight={displayWeight}
          onFinish={handleFinishWorkout}
          onDiscard={handleDiscardWorkout}
        />
        <SessionSummaryModal
          isOpen={summaryModal.isOpen}
          onClose={summaryModal.close}
          session={summaryModal.data}
          mode="complete"
          weightUnit={weightUnit}
          displayWeight={displayWeight}
        />
      </>
    );
  }

  // ============ RENDER: NORMAL VIEW ============
  return (
    <div className="workout-page">
      {/* Header */}
      <header className="workout-header">
        <div>
          <h1 className="header-title">Workout</h1>
          <p className="header-subtitle">Your exercises & PRs </p>
        </div>
        <div className="header-actions">
          {bodyParts.length > 0 && (
            <>
              <button className="header-icon-btn log-btn" onClick={() => logWorkoutModal.open()} title="Log past workout">
                <IoClipboard size={20} />
              </button>
              <button className="header-icon-btn start-btn" onClick={() => startWorkoutModal.open()}>
                <IoPlay size={20} />
              </button>
            </>
          )}
          <button className="header-icon-btn" onClick={() => settingsModal.open()}>
            <IoSettings size={20} />
          </button>
        </div>
      </header>

      {/* View Toggle */}
      <div className="view-toggle">
        <button className={`view-toggle-btn ${!showHistory ? 'active' : ''}`} onClick={() => setShowHistory(false)}>
          <IoBarbell size={16} /><span>Plan</span>
        </button>
        <button className={`view-toggle-btn ${showHistory ? 'active' : ''}`} onClick={handleToggleHistory}>
          <IoCalendar size={16} /><span>History</span>
        </button>
      </div>

      {showHistory ? (
        <WorkoutHistory
          sessions={workoutHistory}
          bodyParts={bodyParts}
          weightUnit={weightUnit}
          displayWeight={displayWeight}
          onDeleteSession={handleDeleteSession}
          onStartWorkout={() => { setShowHistory(false); startWorkoutModal.open(); }}
        />
      ) : (
        <>
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

          {filteredExercises.length > 0 && (
            <div className="workout-summary"><span>{filteredExercises.length} exercises</span></div>
          )}

          <div className="exercises-container">
            {isLoading ? (
              <div className="exercises-list">
                {[1, 2, 3, 4].map(i => (
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredExercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
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
        </>
      )}

      {/* FAB */}
      {bodyParts.length > 0 && !showHistory && <FAB onClick={openAddModal} />}

      {/* Start Workout Modal */}
      <Modal
        isOpen={startWorkoutModal.isOpen}
        onClose={startWorkoutModal.close}
        title="Start Workout"
        className="start-workout-modal"
      >
        <p className="start-workout-subtitle">Choose your split for today</p>
        <div className="split-picker-list">
          {bodyParts.map(bp => {
            const exCount = exercises.filter(e => e.bodyPart === bp.id).length;
            return (
              <button
                key={bp.id}
                className="split-picker-item"
                onClick={() => handleStartWorkout(bp.id)}
                disabled={exCount === 0}
              >
                <div className="split-picker-color" style={{ background: bp.color }} />
                <div className="split-picker-info">
                  <span className="split-picker-name">{bp.name}</span>
                  <span className="split-picker-count">{exCount} exercise{exCount !== 1 ? 's' : ''}</span>
                </div>
                <IoPlay size={20} color={exCount > 0 ? bp.color : '#CBD5E1'} />
              </button>
            );
          })}
        </div>
      </Modal>

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
          <input type="text" value={exerciseName} onChange={e => setExerciseName(e.target.value)} placeholder="e.g., Bench Press" autoFocus />
        </FormGroup>
        <FormRow>
          <FormGroup label="Sets"><NumberControl value={formSets} onChange={setFormSets} min={1} /></FormGroup>
          <FormGroup label="Reps"><NumberControl value={formReps} onChange={setFormReps} min={1} /></FormGroup>
        </FormRow>
        <FormGroup label={`PR Weight (${weightUnit})`}>
          <input
            type="number" value={formWeight === 0 ? '' : formWeight}
            onChange={e => setFormWeight(Number(e.target.value) || 0)}
            onFocus={e => e.target.select()} placeholder="0" min="0" step="2.5"
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
            onSubmit={() => { if (deleteModal.data) { handleDeleteExercise(deleteModal.data.id); deleteModal.close(); } }}
            submitText="Delete" cancelText="Cancel" submitDestructive
          />
        }
      >
        <p>Are you sure you want to delete "{deleteModal.data?.name}"?</p>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
        title="Workout Splits"
        className="settings-modal"
        footer={<button className="btn secondary" onClick={settingsModal.close}>Done</button>}
      >
        <div className="weight-unit-toggle">
          <label className="setting-label">Weight Unit</label>
          <div className="unit-buttons">
            <button className={`unit-btn ${weightUnit === 'kg' ? 'active' : ''}`} onClick={() => handleWeightUnitChange('kg')}>kg</button>
            <button className={`unit-btn ${weightUnit === 'lbs' ? 'active' : ''}`} onClick={() => handleWeightUnitChange('lbs')}>lbs</button>
          </div>
        </div>
        <div className="body-parts-list">
          {bodyParts.map(bp => (
            <div key={bp.id} className="body-part-item">
              <div className="body-part-color" style={{ background: bp.color }} />
              {editingBodyPart?.id === bp.id ? (
                <>
                  <input type="text" value={bpName} onChange={e => setBpName(e.target.value)} className="body-part-input" autoFocus />
                  <ColorPicker value={bpColor} onChange={setBpColor} />
                  <button className="save-bp-btn" onClick={handleSaveBodyPart}>Save</button>
                  <button className="cancel-bp-btn" onClick={resetBodyPartForm}></button>
                </>
              ) : (
                <>
                  <span className="body-part-name">{bp.name}</span>
                  <span className="body-part-exercise-count">{exercises.filter(e => e.bodyPart === bp.id).length} exercises</span>
                  <button className="edit-bp-btn" onClick={() => openEditBodyPart(bp)}><IoPencil size={16} /></button>
                  <button className="delete-bp-btn" onClick={() => handleDeleteBodyPart(bp.id)}><IoTrash size={16} /></button>
                </>
              )}
            </div>
          ))}
        </div>
        {!editingBodyPart && (
          <div className="add-body-part">
            <input type="text" value={bpName} onChange={e => setBpName(e.target.value)} placeholder="New split name (e.g., Push)" className="body-part-input" />
            <ColorPicker value={bpColor} onChange={setBpColor} />
            <button className="btn primary add-bp-btn" onClick={handleSaveBodyPart} disabled={!bpName.trim()}>
              <IoAdd size={18} /> Add Split
            </button>
          </div>
        )}
      </Modal>

      {/* Summary Modal (after finishing workout) */}
      <SessionSummaryModal
        isOpen={summaryModal.isOpen}
        onClose={summaryModal.close}
        session={summaryModal.data}
        mode="complete"
        weightUnit={weightUnit}
        displayWeight={displayWeight}
      />

      {/* Log Past Workout Modal */}
      <LogWorkoutModal
        isOpen={logWorkoutModal.isOpen}
        onClose={logWorkoutModal.close}
        bodyParts={bodyParts}
        exercises={exercises}
        weightUnit={weightUnit}
        onSave={handleLogWorkout}
      />
    </div>
  );
}
