import { useState } from 'react';
import { IoAdd, IoChevronForward } from '../../utils/icons';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TodoItem } from '../../types';
import { SortableTaskItem } from './SortableTaskItem';

interface BacklogGroup {
  month: string;
  monthKey: string;
  tasks: TodoItem[];
  completedTasks: TodoItem[];
}

interface BacklogViewProps {
  groups: BacklogGroup[];
  collapsedMonths: Set<string>;
  currentUserId?: string;
  onToggleCollapsed: (monthKey: string) => void;
  onAddForMonth: (monthKey: string) => void;
  onToggleTask: (todo: TodoItem) => void;
  onEditTask: (todo: TodoItem) => void;
  onDeleteTask: (todo: TodoItem) => void;
  onDragEnd: (event: DragEndEvent, monthKey: string) => void;
}

export function BacklogView({
  groups, collapsedMonths, currentUserId, onToggleCollapsed, onAddForMonth,
  onToggleTask, onEditTask, onDeleteTask, onDragEnd,
}: BacklogViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Completed sub-section is collapsed by default per month so it doesn't
  // crowd the active list, but still surfaces accidental completions.
  const [expandedCompleted, setExpandedCompleted] = useState<Set<string>>(new Set());
  const toggleCompletedExpanded = (monthKey: string) => {
    setExpandedCompleted(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  return (
    <div className="tasks-list">
      {groups.map(group => {
        const isCollapsed = collapsedMonths.has(group.monthKey);
        const showCompleted = expandedCompleted.has(group.monthKey);
        return (
          <div key={group.monthKey} className="backlog-month-group">
            <div
              className="backlog-month-header-row"
              onClick={() => onToggleCollapsed(group.monthKey)}
            >
              <button className="backlog-collapse-btn">
                <IoChevronForward
                  size={18}
                  className={`chevron ${!isCollapsed ? 'expanded' : ''}`}
                />
              </button>
              <h3 className="backlog-month-header">
                {group.month}
                <span className="count-badge">{group.tasks.length}</span>
              </h3>
              <button
                className="backlog-add-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddForMonth(group.monthKey);
                }}
                title="Add task to this month"
              >
                <IoAdd size={18} />
              </button>
            </div>
            {!isCollapsed && (
              <>
                {group.tasks.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => onDragEnd(event, group.monthKey)}
                  >
                    <SortableContext
                      items={group.tasks.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="backlog-month-tasks">
                        {group.tasks.map(todo => (
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
                ) : (
                  <p className="backlog-empty-month">No tasks planned for this month</p>
                )}
                {group.completedTasks.length > 0 && (
                  <div className="backlog-completed-section">
                    <button
                      className="backlog-completed-toggle"
                      onClick={() => toggleCompletedExpanded(group.monthKey)}
                    >
                      <IoChevronForward
                        size={14}
                        className={`chevron ${showCompleted ? 'expanded' : ''}`}
                      />
                      <span>Completed</span>
                      <span className="count-badge">{group.completedTasks.length}</span>
                    </button>
                    {showCompleted && (
                      <div className="backlog-month-tasks">
                        {group.completedTasks.map(todo => (
                          <SortableTaskItem
                            key={todo.id}
                            todo={todo}
                            completed
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
            )}
          </div>
        );
      })}
    </div>
  );
}
