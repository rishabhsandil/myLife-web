import { useState, useEffect } from 'react';
import { Exercise, WeightUnit } from '../../types';
import { Modal, ModalFooter, FormGroup, FormRow, NumberControl } from '../../components';
import { kgToLbs, lbsToKg } from './helpers';

interface ExerciseFormModalProps {
  isOpen: boolean;
  editingExercise: Exercise | null;
  weightUnit: WeightUnit;
  onClose: () => void;
  onSubmit: (values: { name: string; sets: number; reps: number; weightKg: number }) => void;
}

export function ExerciseFormModal({ isOpen, editingExercise, weightUnit, onClose, onSubmit }: ExerciseFormModalProps) {
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    if (editingExercise) {
      setName(editingExercise.name);
      setSets(editingExercise.sets);
      setReps(editingExercise.reps);
      const displayVal = weightUnit === 'lbs' ? kgToLbs(editingExercise.weight) : editingExercise.weight;
      setWeight(Number(displayVal.toFixed(1)));
    } else {
      setName('');
      setSets(3);
      setReps(10);
      setWeight(0);
    }
  }, [isOpen, editingExercise, weightUnit]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const weightKg = weightUnit === 'lbs' ? lbsToKg(weight) : weight;
    onSubmit({ name: name.trim(), sets, reps, weightKg });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingExercise ? 'Edit Exercise' : 'Add Exercise'}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitText={editingExercise ? 'Save Changes' : 'Add Exercise'}
          submitDisabled={!name.trim()}
        />
      }
    >
      <FormGroup label="Exercise Name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Bench Press" autoFocus />
      </FormGroup>
      <FormRow>
        <FormGroup label="Sets"><NumberControl value={sets} onChange={setSets} min={1} /></FormGroup>
        <FormGroup label="Reps"><NumberControl value={reps} onChange={setReps} min={1} /></FormGroup>
      </FormRow>
      <FormGroup label={`PR Weight (${weightUnit})`}>
        <input
          type="number"
          value={weight === 0 ? '' : weight}
          onChange={e => setWeight(Number(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          placeholder="0"
          min="0"
          step="2.5"
        />
      </FormGroup>
    </Modal>
  );
}
