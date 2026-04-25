import {
  IoAdd, IoCalendarOutline, IoCheckmarkCircle, IoChevronForward,
} from '../../utils/icons';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TodoItem } from '../../types';
import { EmptyState } from '../../components';
import { SortableTaskItem } from './SortableTaskItem';

interface ScheduleViewProps {
  todaysTasksLength: number;
  overdueTasks: TodoItem[];
  incompleteTasks: TodoItem[];
  completedTasks: TodoItem[];
  showCompletedTasks: boolean;
  currentUserId?: string;
  onSetShowCompletedTasks: (val: boolean) => void;
  onAddTask: () => void;
  onToggleTask: (todo: TodoItem) => void;
  onEditTask: (todo: TodoItem) => void;
  onDeleteTask: (todo: TodoItem) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function ScheduleView({
  todaysTasksLength, overdueTasks, incompleteTasks, completedTasks,
  showCompletedTasks, currentUserId, onSetShowCompletedTasks, onAddTask,
  onToggleTask, onEditTask, onDeleteTask, onDragEnd,
}: ScheduleViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (todaysTasksLength === 0) {
    return (
      <EmptyState
        icon={IoCalendarOutline}
        message="No tasks for this day"
        action={{ label: 'Add Task', icon: IoAdd, onClick: onAddTask }}
      />
    );
  }

  return (
    <>
      {overdueTasks.length > 0 && (
        <div className="overdue-section">
          <div className="section-label overdue-label">
            <span>Overdue ({overdueTasks.length})</span>
          </div>
          <div className="tasks-list">
            {overdueTasks.map(todo => (
              <SortableTaskItem
                key={todo.id}
                todo={todo}
                completed={false}
                currentUserId={currentUserId}
                onToggle={() => onToggleTask(todo)}
                onEdit={() => onEditTask(todo)}
                onDelete={() => onDeleteTask(todo)}
              />
            ))}
          </div>
        </div>
      )}

      {incompleteTasks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={incompleteTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="tasks-list">
              {incompleteTasks.map(todo => (
                <SortableTaskItem
                  key={todo.id}
                  todo={todo}
                  completed={false}
                  currentUserId={currentUserId}
                  onToggle={() => onToggleTask(todo)}
                  onEdit={() => onEditTask(todo)}
                  onDelete={() => onDeleteTask(todo)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {completedTasks.length > 0 && (
        <div className="completed-section">
          <button
            className="completed-header"
            onClick={() => onSetShowCompletedTasks(!showCompletedTasks)}
          >
            <IoCheckmarkCircle size={20} />
            <span>Completed ({completedTasks.length})</span>
            <IoChevronForward
              size={18}
              className={`chevron ${showCompletedTasks ? 'expanded' : ''}`}
            />
          </button>
          {showCompletedTasks && (
            <div className="tasks-list completed-tasks">
              {completedTasks.map(todo => (
                <SortableTaskItem
                  key={todo.id}
                  todo={todo}
                  completed={true}
                  currentUserId={currentUserId}
                  onToggle={() => onToggleTask(todo)}
                  onEdit={() => onEditTask(todo)}
                  onDelete={() => onDeleteTask(todo)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
