import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { IoAdd, IoBarbell, IoSettings } from 'react-icons/io5';
import { BodyPart, Exercise, WeightUnit } from '../../types';
import { EmptyState, FAB } from '../../components';
import { SortableExerciseItem } from './SortableExerciseItem';

interface WorkoutPlanViewProps {
  isLoading: boolean;
  bodyParts: BodyPart[];
  selectedBodyPart: string;
  filteredExercises: Exercise[];
  weightUnit: WeightUnit;
  displayWeight: (kg: number) => string;
  getBodyPartColor: (id: string) => string;
  onSelectBodyPart: (id: string) => void;
  onOpenSettings: () => void;
  onAddExercise: () => void;
  onEditExercise: (exercise: Exercise) => void;
  onDeleteExercise: (exercise: Exercise) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function WorkoutPlanView({
  isLoading, bodyParts, selectedBodyPart, filteredExercises,
  weightUnit, displayWeight, getBodyPartColor,
  onSelectBodyPart, onOpenSettings, onAddExercise, onEditExercise, onDeleteExercise, onDragEnd,
}: WorkoutPlanViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const currentBodyPart = bodyParts.find(bp => bp.id === selectedBodyPart);

  return (
    <>
      <div className="body-parts">
        {bodyParts.map(part => (
          <button
            key={part.id}
            className={`body-part-btn ${selectedBodyPart === part.id ? 'active' : ''}`}
            style={{ '--part-color': part.color } as React.CSSProperties}
            onClick={() => onSelectBodyPart(part.id)}
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
            action={{ label: 'Configure Splits', icon: IoSettings, onClick: onOpenSettings }}
          />
        ) : filteredExercises.length === 0 ? (
          <EmptyState
            icon={IoBarbell}
            message={`No exercises for ${currentBodyPart?.name || 'this split'}`}
            action={{ label: 'Add Exercise', icon: IoAdd, onClick: onAddExercise }}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filteredExercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <div className="exercises-list">
                {filteredExercises.map(exercise => (
                  <SortableExerciseItem
                    key={exercise.id}
                    exercise={exercise}
                    bodyPartColor={getBodyPartColor(exercise.bodyPart)}
                    weightUnit={weightUnit}
                    displayWeight={displayWeight}
                    onEdit={() => onEditExercise(exercise)}
                    onDelete={() => onDeleteExercise(exercise)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {bodyParts.length > 0 && <FAB onClick={onAddExercise} />}
    </>
  );
}
