import { useState } from 'react';
import { IoBarbell, IoTrophy, IoTrash, IoReorderTwo } from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Exercise, WeightUnit } from '../../types';
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
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
        onDelete();
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
    <div ref={setNodeRef} style={style} className={`exercise-card ${isDragging ? 'dragging' : ''}`}>
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div className="exercise-card-content" style={contentStyle} {...swipeHandlers}>
        <button className="drag-handle" {...attributes} {...listeners}>
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
