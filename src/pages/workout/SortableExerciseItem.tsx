import { IoBarbell, IoTrophy, IoReorderTwo } from 'react-icons/io5';
import { Exercise, WeightUnit } from '../../types';
import { SortableSwipeItem } from '../../components';
import { colors } from '../../utils/theme';

interface SortableExerciseItemProps {
  exercise: Exercise;
  bodyPartColor: string;
  weightUnit: WeightUnit;
  displayWeight: (kg: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableExerciseItem({ exercise, bodyPartColor, weightUnit, displayWeight, onEdit, onDelete }: SortableExerciseItemProps) {
  return (
    <SortableSwipeItem
      id={exercise.id}
      onSwipeDelete={onDelete}
      wrapperClassName={(isDragging) => `exercise-card ${isDragging ? 'dragging' : ''}`}
      contentClassName="exercise-card-content"
    >
      {({ dragHandleProps }) => (
        <>
          <button className="drag-handle" {...dragHandleProps}>
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
        </>
      )}
    </SortableSwipeItem>
  );
}
