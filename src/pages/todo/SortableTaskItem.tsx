import {
  IoCheckmarkCircle, IoEllipseOutline, IoRepeat, IoTime,
  IoReorderTwo, IoPersonAdd,
} from '../../utils/icons';
import { TodoItem } from '../../types';
import { SortableSwipeItem } from '../../components';
import { colors } from '../../utils/theme';
import { DAY_LABELS } from './todoConstants';
import { parseRecurrenceLabel } from './todoHelpers';

interface SortableTaskItemProps {
  todo: TodoItem;
  completed: boolean;
  currentUserId?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableTaskItem({
  todo, completed, currentUserId, onToggle, onEdit, onDelete,
}: SortableTaskItemProps) {
  const isOverdue = todo.recurrence === 'none' && !!todo.overdue;
  return (
    <SortableSwipeItem
      id={todo.id}
      onSwipeDelete={onDelete}
      wrapperClassName={(isDragging) =>
        `task-item ${completed ? 'completed' : ''} ${isOverdue && !completed ? 'overdue' : ''} ${isDragging ? 'dragging' : ''}`
      }
      contentClassName="task-item-content"
    >
      {({ dragHandleProps }) => (
        <>
          <button className="drag-handle" {...dragHandleProps}>
            <IoReorderTwo size={18} color={colors.textMuted} />
          </button>
          <button className="task-checkbox" onClick={onToggle}>
            {completed ? (
              <IoCheckmarkCircle size={22} color={colors.success} />
            ) : (
              <IoEllipseOutline size={22} color={colors.textMuted} />
            )}
          </button>
          <div className="task-content" onClick={onEdit}>
            <span className="task-title">{todo.title}</span>
            <div className="task-info">
              {(todo.time || todo.category || todo.recurrence !== 'none' || (isOverdue && !completed)) && (                <div className="task-meta">
                  {todo.time && <span><IoTime size={11} /> {todo.time}</span>}
                  {todo.category && <span className="task-category">{todo.category}</span>}
                  {todo.recurrence !== 'none' && (
                    <span className="recurrence-badge" title={parseRecurrenceLabel(todo)}>
                      <IoRepeat size={11} />
                      {todo.recurrence === 'daily' && <span className="recurrence-label">Daily</span>}
                      {todo.recurrence === 'weekly' && <span className="recurrence-label">Wk</span>}
                      {todo.recurrence === 'biweekly' && <span className="recurrence-label">2Wk</span>}
                      {todo.recurrence === 'monthly' && <span className="recurrence-label">Mo</span>}
                      {todo.recurrence === 'yearly' && <span className="recurrence-label">Yr</span>}
                      {todo.recurrence === 'custom' && todo.recurrenceDays && (
                        <span className="recurrence-label">{todo.recurrenceDays.map(d => DAY_LABELS[d]).join('')}</span>
                      )}
                    </span>
                  )}
                  {todo.recurrence === 'none' && todo.overdue && !completed && (
                    <span className="badge overdue" title={`Originally due: ${todo.originalDate}`}>
                      Overdue
                    </span>
                  )}
                </div>
              )}
              {(todo.assignedToUserId || (todo.ownerId && todo.ownerId !== currentUserId)) && (
                <div className="task-badges">
                  {todo.assignedToUserId && (
                    <span className="badge assigned" title={`Assigned to: ${todo.assigneeName}`}>
                      <IoPersonAdd size={10} /> {todo.assigneeName}
                    </span>
                  )}
                  {todo.ownerId && todo.ownerId !== currentUserId && todo.ownerName && (
                    <span className="badge assigned-from" title={`From: ${todo.ownerName}`}>
                      From {todo.ownerName}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </SortableSwipeItem>
  );
}
