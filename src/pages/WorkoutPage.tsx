import { useState, useEffect } from 'react';
import { IoBarbell, IoSettings, IoPlay, IoCalendar, IoClipboard } from 'react-icons/io5';
import { arrayMove } from '@dnd-kit/sortable';
import { DragEndEvent } from '@dnd-kit/core';
import { Exercise, BodyPart, WeightUnit, WorkoutSession } from '../types';
import {
  getExercises, saveExercise, updateExercise, deleteExercise as apiDeleteExercise,
  getBodyParts, saveBodyPart, updateBodyPart, deleteBodyPart as apiDeleteBodyPart,
  getWorkoutSessions, saveWorkoutSession, deleteWorkoutSession,
} from '../utils/api.ts';
import {
  getWeightUnit, saveWeightUnit, clearActiveWorkoutSession, saveActiveWorkoutSession,
} from '../utils/storage.ts';
import { Modal, ModalFooter } from '../components';
import { useToast } from '../components/Toast';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';

import { makeDisplayWeight, buildSessionExercises, getBodyPartColor as getBpColor, toLocalDateString } from './workout/helpers';
import { ActiveSession } from './workout/ActiveSession';
import { WorkoutHistory } from './workout/WorkoutHistory';
import { SessionSummaryModal } from './workout/SessionSummaryModal';
import { LogWorkoutModal } from './workout/LogWorkoutModal';
import { WorkoutPlanView } from './workout/WorkoutPlanView';
import { ExerciseFormModal } from './workout/ExerciseFormModal';
import { StartWorkoutModal } from './workout/StartWorkoutModal';
import { WorkoutSettingsModal } from './workout/WorkoutSettingsModal';
import { useSessionMachine } from './workout/sessionReducer';

import './workout/WorkoutPage.css';

export default function WorkoutPage() {
  const { showError } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [sessionState, dispatchSession] = useSessionMachine();
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const exerciseModal = useModal<Exercise>();
  const settingsModal = useModal();
  const deleteModal = useModal<Exercise>();
  const deleteBodyPartModal = useModal<BodyPart>();
  const deleteSessionModal = useModal<WorkoutSession>();
  const startWorkoutModal = useModal();
  const logWorkoutModal = useModal();

  const displayWeight = makeDisplayWeight(weightUnit);
  const getBodyPartColor = (partId: string) => getBpColor(bodyParts, partId, colors.primary);

  useEffect(() => {
    const ac = new AbortController();
    void loadData(ac.signal);
    setWeightUnit(getWeightUnit());
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(signal?: AbortSignal) {
    setIsLoading(true);
    try {
      const [exerciseData, bodyPartData] = await Promise.all([getExercises(signal), getBodyParts(signal)]);
      setExercises(exerciseData);
      setBodyParts(bodyPartData);
      if (bodyPartData.length > 0 && !selectedBodyPart) {
        setSelectedBodyPart(bodyPartData[0].id);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(err, 'Failed to load workout data');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadHistory() {
    const sessions = await getWorkoutSessions();
    setWorkoutHistory(sessions);
  }

  const filteredExercises = exercises
    .filter(e => e.bodyPart === selectedBodyPart)
    .sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
      if (a.sortOrder !== undefined) return -1;
      if (b.sortOrder !== undefined) return 1;
      return 0;
    });

  // ---- Exercise CRUD ----
  const handleSaveExercise = async (values: { name: string; sets: number; reps: number; weightKg: number }) => {
    const previousExercises = exercises;
    if (exerciseModal.data) {
      const updated: Exercise = {
        ...exerciseModal.data,
        name: values.name, sets: values.sets, reps: values.reps, weight: values.weightKg,
      };
      setExercises(exercises.map(e => e.id === updated.id ? updated : e));
      exerciseModal.close();
      try { await updateExercise(updated); }
      catch (err) { setExercises(previousExercises); showError(err, 'Failed to update exercise'); }
    } else {
      const newExercise: Exercise = {
        id: Date.now().toString(),
        name: values.name, bodyPart: selectedBodyPart,
        sets: values.sets, reps: values.reps, weight: values.weightKg,
      };
      setExercises([...exercises, newExercise]);
      exerciseModal.close();
      try { await saveExercise(newExercise); }
      catch (err) { setExercises(previousExercises); showError(err, 'Failed to add exercise'); }
    }
  };

  const handleDeleteExercise = async (id: string) => {
    const previousExercises = exercises;
    setExercises(exercises.filter(e => e.id !== id));
    try { await apiDeleteExercise(id); }
    catch (err) { setExercises(previousExercises); showError(err, 'Failed to delete exercise'); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = filteredExercises.findIndex(ex => ex.id === active.id);
      const newIndex = filteredExercises.findIndex(ex => ex.id === over.id);
      const reordered = arrayMove(filteredExercises, oldIndex, newIndex).map((ex, i) => ({ ...ex, sortOrder: i }));
      const previousExercises = exercises;
      setExercises(exercises.map(e => reordered.find(ue => ue.id === e.id) || e));
      try {
        for (const ex of reordered) { await updateExercise(ex); }
      } catch (err) {
        setExercises(previousExercises);
        showError(err, 'Failed to reorder exercises');
      }
    }
  };

  // ---- Settings ----
  const handleWeightUnitChange = (unit: WeightUnit) => { setWeightUnit(unit); saveWeightUnit(unit); };

  const handleSaveBodyPart = async (values: { editing: BodyPart | null; name: string; color: string }) => {
    const previousBodyParts = bodyParts;
    const previousSelected = selectedBodyPart;
    if (values.editing) {
      const updated: BodyPart = { ...values.editing, name: values.name, color: values.color };
      setBodyParts(bodyParts.map(bp => bp.id === updated.id ? updated : bp));
      try { await updateBodyPart(updated); }
      catch (err) { setBodyParts(previousBodyParts); showError(err, 'Failed to update body part'); }
    } else {
      const newBp: BodyPart = { id: `bp_${Date.now()}`, name: values.name, color: values.color };
      setBodyParts([...bodyParts, newBp]);
      if (!selectedBodyPart) setSelectedBodyPart(newBp.id);
      try { await saveBodyPart(newBp); }
      catch (err) {
        setBodyParts(previousBodyParts); setSelectedBodyPart(previousSelected);
        showError(err, 'Failed to add body part');
      }
    }
  };

  const handleDeleteBodyPart = async (id: string) => {
    const previousBodyParts = bodyParts;
    const previousExercises = exercises;
    const previousSelected = selectedBodyPart;
    setBodyParts(bodyParts.filter(bp => bp.id !== id));
    setExercises(exercises.filter(e => e.bodyPart !== id));
    if (selectedBodyPart === id) {
      const remaining = bodyParts.filter(bp => bp.id !== id);
      setSelectedBodyPart(remaining.length > 0 ? remaining[0].id : '');
    }
    try { await apiDeleteBodyPart(id); }
    catch (err) {
      setBodyParts(previousBodyParts); setExercises(previousExercises); setSelectedBodyPart(previousSelected);
      showError(err, 'Failed to delete body part');
    }
  };

  // ---- Session lifecycle ----
  const handleStartWorkout = (bodyPartId: string) => {
    const bp = bodyParts.find(b => b.id === bodyPartId);
    if (!bp) return;
    const sessionExercises = buildSessionExercises(exercises, bodyPartId);
    const now = new Date();
    const session: WorkoutSession = {
      id: `ws_${Date.now()}`,
      bodyPartId: bp.id, bodyPartName: bp.name,
      date: toLocalDateString(now),
      startTime: now.toISOString(),
      exercises: sessionExercises,
      createdAt: now.toISOString(),
    };
    dispatchSession({ type: 'start', session });
    saveActiveWorkoutSession(session);
    startWorkoutModal.close();
  };

  const handleFinishWorkout = async (session: WorkoutSession, duration: number) => {
    const completed: WorkoutSession = { ...session, endTime: new Date().toISOString(), duration };
    await saveWorkoutSession(completed);
    for (const sessionEx of completed.exercises) {
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
    dispatchSession({ type: 'finish', session: completed });
  };

  const handleDiscardWorkout = () => {
    clearActiveWorkoutSession();
    dispatchSession({ type: 'discard' });
  };

  const handleToggleHistory = async () => {
    if (!showHistory) await loadHistory();
    setShowHistory(!showHistory);
  };

  const handleDeleteSession = async (id: string) => {
    const previousHistory = workoutHistory;
    setWorkoutHistory(prev => prev.filter(s => s.id !== id));
    try { await deleteWorkoutSession(id); }
    catch (err) { setWorkoutHistory(previousHistory); showError(err, 'Failed to delete workout'); }
  };

  const handleLogWorkout = async (session: WorkoutSession) => {
    try {
      await saveWorkoutSession(session);
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
      if (showHistory) await loadHistory();
    } catch (err) {
      showError(err, 'Failed to save workout');
    }
  };

  // ---- Render: active session ----
  if (sessionState.status === 'active' && !sessionState.viewingPlan) {
    const { session: activeSession } = sessionState;
    return (
      <ActiveSession
        session={activeSession}
        exercises={exercises}
        bodyPartColor={getBodyPartColor(activeSession.bodyPartId)}
        weightUnit={weightUnit}
        displayWeight={displayWeight}
        onFinish={handleFinishWorkout}
        onDiscard={handleDiscardWorkout}
        onViewPlan={() => dispatchSession({ type: 'viewPlan' })}
        onSessionUpdate={(s) => dispatchSession({ type: 'update', session: s })}
      />
    );
  }

  // ---- Render: normal view ----
  return (
    <div className="workout-page">
      {sessionState.status === 'active' && sessionState.viewingPlan && (
        <button
          className="active-session-banner"
          style={{ background: getBodyPartColor(sessionState.session.bodyPartId) }}
          onClick={() => dispatchSession({ type: 'resume' })}
        >
          <IoPlay size={16} />
          <span>{sessionState.session.bodyPartName} in progress — tap to return</span>
        </button>
      )}

      <header className="workout-header">
        <div>
          <h1 className="header-title">Workout</h1>
          <p className="header-subtitle">Your exercises & PRs </p>
        </div>
        <div className="header-actions">
          {bodyParts.length > 0 && (
            <>
              <button className="header-icon-btn start-btn" onClick={() => startWorkoutModal.open()}>
                <IoPlay size={20} />
              </button>
              <button className="header-icon-btn log-btn" onClick={() => logWorkoutModal.open()} title="Log past workout">
                <IoClipboard size={20} />
              </button>
            </>
          )}
          <button className="header-icon-btn" onClick={() => settingsModal.open()}>
            <IoSettings size={20} />
          </button>
        </div>
      </header>

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
          onDeleteSession={(id) => {
            const session = workoutHistory.find(s => s.id === id);
            if (session) deleteSessionModal.open(session);
          }}
          onStartWorkout={() => { setShowHistory(false); startWorkoutModal.open(); }}
        />
      ) : (
        <WorkoutPlanView
          isLoading={isLoading}
          bodyParts={bodyParts}
          selectedBodyPart={selectedBodyPart}
          filteredExercises={filteredExercises}
          weightUnit={weightUnit}
          displayWeight={displayWeight}
          getBodyPartColor={getBodyPartColor}
          onSelectBodyPart={setSelectedBodyPart}
          onOpenSettings={() => settingsModal.open()}
          onAddExercise={() => exerciseModal.open()}
          onEditExercise={(ex) => exerciseModal.open(ex)}
          onDeleteExercise={(ex) => deleteModal.open(ex)}
          onDragEnd={handleDragEnd}
        />
      )}

      <StartWorkoutModal
        isOpen={startWorkoutModal.isOpen}
        bodyParts={bodyParts}
        exercises={exercises}
        onClose={startWorkoutModal.close}
        onStart={handleStartWorkout}
      />

      <ExerciseFormModal
        isOpen={exerciseModal.isOpen}
        editingExercise={exerciseModal.data ?? null}
        weightUnit={weightUnit}
        onClose={exerciseModal.close}
        onSubmit={handleSaveExercise}
      />

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

      <WorkoutSettingsModal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
        bodyParts={bodyParts}
        exercises={exercises}
        weightUnit={weightUnit}
        onWeightUnitChange={handleWeightUnitChange}
        onSaveBodyPart={handleSaveBodyPart}
        onRequestDeleteBodyPart={(bp) => deleteBodyPartModal.open(bp)}
      />

      <SessionSummaryModal
        isOpen={sessionState.status === 'summary'}
        onClose={() => dispatchSession({ type: 'closeSummary' })}
        session={sessionState.status === 'summary' ? sessionState.session : null}
        mode="complete"
        weightUnit={weightUnit}
        displayWeight={displayWeight}
      />

      <LogWorkoutModal
        isOpen={logWorkoutModal.isOpen}
        onClose={logWorkoutModal.close}
        bodyParts={bodyParts}
        exercises={exercises}
        weightUnit={weightUnit}
        onSave={handleLogWorkout}
      />

      <Modal
        isOpen={deleteBodyPartModal.isOpen}
        onClose={deleteBodyPartModal.close}
        title="Delete Split"
        footer={
          <ModalFooter
            onCancel={deleteBodyPartModal.close}
            onSubmit={() => {
              if (deleteBodyPartModal.data) {
                handleDeleteBodyPart(deleteBodyPartModal.data.id);
                deleteBodyPartModal.close();
              }
            }}
            submitText="Delete"
            submitDestructive={true}
          />
        }
      >
        <p>Are you sure you want to delete this split?</p>
        {deleteBodyPartModal.data && (
          <>
            <p><strong>{deleteBodyPartModal.data.name}</strong></p>
            <p>This will also delete all {exercises.filter(e => e.bodyPart === deleteBodyPartModal.data!.id).length} exercise{exercises.filter(e => e.bodyPart === deleteBodyPartModal.data!.id).length !== 1 ? 's' : ''} in this split.</p>
          </>
        )}
      </Modal>

      <Modal
        isOpen={deleteSessionModal.isOpen}
        onClose={deleteSessionModal.close}
        title="Delete Workout"
        footer={
          <ModalFooter
            onCancel={deleteSessionModal.close}
            onSubmit={() => {
              if (deleteSessionModal.data) {
                handleDeleteSession(deleteSessionModal.data.id);
                deleteSessionModal.close();
              }
            }}
            submitText="Delete"
            submitDestructive={true}
          />
        }
      >
        <p>Are you sure you want to delete this workout?</p>
        {deleteSessionModal.data && (
          <p><strong>{deleteSessionModal.data.bodyPartName} - {new Date(deleteSessionModal.data.date + 'T00:00:00').toLocaleDateString()}</strong></p>
        )}
      </Modal>
    </div>
  );
}
