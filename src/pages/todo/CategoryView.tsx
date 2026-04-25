import { IoAdd, IoCalendarOutline } from '../../utils/icons';
import { TodoItem } from '../../types';
import { EmptyState } from '../../components';
import { SortableTaskItem } from './SortableTaskItem';
import { formatDate, isToday } from './todoHelpers';

interface Category { id: string; name: string; color: string }

interface CategoryViewProps {
  categories: Category[];
  selectedCategory: string | null;
  categoryTasks: TodoItem[];
  currentUserId?: string;
  onSelectCategory: (id: string) => void;
  onAddTask: () => void;
  onToggleTask: (todo: TodoItem) => void;
  onEditTask: (todo: TodoItem) => void;
  onDeleteTask: (todo: TodoItem) => void;
}

export function CategoryView({
  categories, selectedCategory, categoryTasks, currentUserId,
  onSelectCategory, onAddTask, onToggleTask, onEditTask, onDeleteTask,
}: CategoryViewProps) {
  return (
    <div className="category-view">
      <div className="category-filter">
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
            style={{
              borderColor: cat.color,
              backgroundColor: selectedCategory === cat.id ? cat.color : 'transparent',
              color: selectedCategory === cat.id ? '#fff' : cat.color,
            }}
            onClick={() => onSelectCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {!selectedCategory ? (
        <EmptyState
          icon={IoCalendarOutline}
          message="Select a category to view tasks"
        />
      ) : categoryTasks.length === 0 ? (
        <EmptyState
          icon={IoCalendarOutline}
          message="No upcoming tasks in this category"
          action={{ label: 'Add Task', icon: IoAdd, onClick: onAddTask }}
        />
      ) : (
        <div className="tasks-list category-tasks-list">
          {categoryTasks.map(todo => {
            const taskDate = todo.date && todo.date !== 'backlog' ? todo.date : null;
            const dateLabel = taskDate
              ? isToday(new Date(taskDate + 'T00:00:00'))
                ? 'Today'
                : formatDate(new Date(taskDate + 'T00:00:00'))
              : 'Backlog';

            return (
              <div key={todo.id} className="category-task-item">
                <div className="category-task-date">{dateLabel}</div>
                <SortableTaskItem
                  todo={todo}
                  completed={false}
                  currentUserId={currentUserId}
                  onToggle={() => onToggleTask(todo)}
                  onEdit={() => onEditTask(todo)}
                  onDelete={() => onDeleteTask(todo)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
