import { IoPlay } from 'react-icons/io5';
import { BodyPart, Exercise } from '../../types';
import { Modal } from '../../components';

interface StartWorkoutModalProps {
  isOpen: boolean;
  bodyParts: BodyPart[];
  exercises: Exercise[];
  onClose: () => void;
  onStart: (bodyPartId: string) => void;
}

export function StartWorkoutModal({ isOpen, bodyParts, exercises, onClose, onStart }: StartWorkoutModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start Workout" className="start-workout-modal">
      <p className="start-workout-subtitle">Choose your split for today</p>
      <div className="split-picker-list">
        {bodyParts.map(bp => {
          const exCount = exercises.filter(e => e.bodyPart === bp.id).length;
          return (
            <button
              key={bp.id}
              className="split-picker-item"
              onClick={() => onStart(bp.id)}
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
  );
}
