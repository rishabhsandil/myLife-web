import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoCalendar, IoChevronBack, IoChevronForward, IoClose,
  IoCheckmarkCircle, IoEllipseOutline, IoRepeat, IoTrash,
  IoTime, IoCalendarOutline, IoPencil, IoReorderTwo, IoSettingsOutline
} from 'react-icons/io5';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TodoItem, Priority, RecurrenceType } from '../types';
import { getTodos, saveTodo, updateTodo, deleteTodo as apiDeleteTodo, getTodoCategories, saveTodoCategory, updateTodoCategory, deleteTodoCategory } from '../utils/api.ts';
import { Modal, ModalFooter, FormGroup, FormRow, OptionPills, ColorPicker, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import logo from '../assets/logo.png';
import './TodoPage.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const RECURRENCE_OPTIONS: { key: RecurrenceType; label: string }[] = [
  { key: 'none', label: 'Once' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

const PRIORITY_OPTIONS: { key: Priority; label: string; color: string }[] = [
  { key: 'low', label: 'Low', color: colors.success },
  { key: 'medium', label: 'Medium', color: colors.warning },
  { key: 'high', label: 'High', color: colors.error },
];

const COLOR_OPTIONS = [
  '#6366F1', '#EC4899', '#EF4444', '#22C55E',
  '#F59E0B', '#8B5CF6', '#14B8A6', '#64748B'
];

// Date helper functions
const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDate = (date: Date): string => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
const isToday = (date: Date): boolean => formatDateKey(date) === formatDateKey(new Date());

// Sortable Task Item Component
interface SortableTaskItemProps {
  todo: TodoItem;
  completed: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableTaskItem({ todo, completed, onToggle, onEdit, onDelete }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`task-item ${completed ? 'completed' : ''} ${todo.overdue && !completed ? 'overdue' : ''}`}
    >
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
      >
        <IoReorderTwo size={20} color={colors.textMuted} />
      </button>
      <button
        className="task-checkbox"
        onClick={onToggle}
      >
        {completed ? (
          <IoCheckmarkCircle size={24} color={colors.success} />
        ) : (
          <IoEllipseOutline size={24} color={colors.textMuted} />
        )}
      </button>
      <div className="task-content">
        <div className="task-title-row">
          <span className="task-title">{todo.title}</span>
          <div className="task-badges">
            {todo.overdue && !completed && (
              <span className="badge overdue" title={`Originally due: ${todo.originalDate}`}>
                <IoTime size={12} /> Overdue
              </span>
            )}
            {todo.recurrence !== 'none' && (
              <span className="badge recurring">
                <IoRepeat size={12} />
              </span>
            )}
            {todo.isEvent && (
              <span className="badge event">
                <IoCalendar size={12} />
              </span>
            )}
          </div>
        </div>
        {todo.description && <p className="task-description">{todo.description}</p>}
        <div className="task-meta">
          {todo.time && <span className="task-time"><IoTime size={14} /> {todo.time}</span>}
          {todo.category && <span className="task-category">{todo.category}</span>}
        </div>
      </div>
      <div className="task-actions">
        <button className="icon-btn" onClick={onEdit}>
          <IoPencil size={18} />
        </button>
        <button className="icon-btn delete" onClick={onDelete}>
          <IoTrash size={18} />
        </button>
      </div>
    </div>
  );
}

export default function TodoPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string; sortOrder: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  
  const taskModal = useModal<TodoItem>();
  const deleteModal = useModal<TodoItem>();
  const categoryModal = useModal();

  // Form state
  const [title, setTitle] = useState('');
  const [taskDate, setTaskDate] = useState(formatDateInput(new Date()));
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  
  // Category management state
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; color: string } | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#6366F1');

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadTodos();
    loadCategories();
  }, []);

  async function loadCategories() {
    const data = await getTodoCategories();
    setCategories(data);
  }

  // Check for overdue tasks and carry them forward
  useEffect(() => {
    const checkOverdueTasks = async () => {
      const today = formatDateKey(new Date());
      let hasUpdates = false;
      
      const updatedTodos = todos.map(todo => {
        // Skip if completed, recurring, or already processed today
        if (todo.completed || todo.recurrence !== 'none' || todo.date >= today) {
          return todo;
        }
        
        // Task is from the past and not completed - mark as overdue and move to today
        hasUpdates = true;
        return {
          ...todo,
          originalDate: todo.originalDate || todo.date, // Preserve original date
          date: today,
          overdue: true,
        };
      });

      if (hasUpdates) {
        // Update all overdue tasks
        for (const todo of updatedTodos) {
          if (todo.overdue && todos.find(t => t.id === todo.id)?.date !== today) {
            await updateTodo(todo);
          }
        }
        setTodos(updatedTodos);
      }
    };

    if (todos.length > 0) {
      checkOverdueTasks();
    }
  }, [todos.length]); // Only run when todos are loaded or count changes

  async function loadTodos() {
    setIsLoading(true);
    const data = await getTodos();
    setTodos(data);
    setIsLoading(false);
  }

  const shouldShowOnDate = (todo: TodoItem, date: Date): boolean => {
    const dateKey = formatDateKey(date);
    const todoDateKey = todo.date;

    if (todo.excludedDates?.includes(dateKey)) return false;
    if (todo.recurrence === 'none') return todoDateKey === dateKey;
    if (dateKey < todoDateKey) return false;

    const todoDate = new Date(todo.date + 'T00:00:00');
    const checkDate = new Date(dateKey + 'T00:00:00');

    switch (todo.recurrence) {
      case 'daily': return true;
      case 'weekly': return checkDate.getDay() === todoDate.getDay();
      case 'monthly': return checkDate.getDate() === todoDate.getDate();
      case 'yearly':
        return checkDate.getDate() === todoDate.getDate() && checkDate.getMonth() === todoDate.getMonth();
      default: return false;
    }
  };

  const isCompletedOnDate = (todo: TodoItem, date: Date): boolean => {
    const dateKey = formatDateKey(date);
    if (todo.recurrence === 'none') return todo.completed;
    return todo.completedDates?.includes(dateKey) || false;
  };

  const todaysTasks = useMemo(() => {
    return todos
      .filter(todo => shouldShowOnDate(todo, selectedDate))
      .sort((a, b) => {
        const aCompleted = isCompletedOnDate(a, selectedDate);
        const bCompleted = isCompletedOnDate(b, selectedDate);
        
        // Completed tasks always go to bottom
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
        
        // Both completed or both incomplete - prioritize sortOrder if set
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        
        // Sort by time
        // Tasks with time come before tasks without time
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        
        // Both have time - sort by time
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        
        // Both have no time - maintain original order
        return 0;
      });
  }, [todos, selectedDate]);

  const resetForm = () => {
    setTitle('');
    setTaskDate(formatDateInput(selectedDate));
    setTime('');
    setPriority('medium');
    setCategory('');
    setRecurrence('none');
  };

  const openAddModal = () => {
    resetForm();
    taskModal.open();
  };

  const openEditModal = (todo: TodoItem) => {
    setTitle(todo.title);
    setTaskDate(todo.date);
    setTime(todo.time || '');
    setPriority(todo.priority);
    setCategory(todo.category || '');
    setRecurrence(todo.recurrence);
    taskModal.open(todo);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const todoData: TodoItem = {
      id: taskModal.data?.id || Date.now().toString(),
      title: title.trim(),
      completed: false,
      date: taskDate,
      time: time || undefined,
      priority,
      category: category || undefined,
      recurrence,
      completedDates: taskModal.data?.completedDates || [],
      excludedDates: taskModal.data?.excludedDates || [],
      createdAt: taskModal.data?.createdAt || new Date().toISOString(),
    };

    if (taskModal.data) {
      await updateTodo(todoData);
      setTodos(todos.map(t => t.id === taskModal.data!.id ? todoData : t));
    } else {
      await saveTodo(todoData);
      setTodos([...todos, todoData]);
    }

    taskModal.close();
  };

  const toggleComplete = async (todo: TodoItem) => {
    const dateKey = formatDateKey(selectedDate);
    const today = formatDateKey(new Date());
    let updatedTodoData: TodoItem;

    if (todo.recurrence === 'none') {
      const isCompleting = !todo.completed;
      updatedTodoData = { 
        ...todo, 
        completed: isCompleting,
        // Clear overdue when completing; restore overdue when uncompleting if task is from the past
        overdue: isCompleting ? false : (todo.originalDate ? true : todo.date < today)
      };
    } else {
      const completedDates = todo.completedDates || [];
      const isCompleted = completedDates.includes(dateKey);
      updatedTodoData = {
        ...todo,
        completedDates: isCompleted
          ? completedDates.filter(d => d !== dateKey)
          : [...completedDates, dateKey],
      };
    }

    await updateTodo(updatedTodoData);
    setTodos(todos.map(t => t.id === todo.id ? updatedTodoData : t));
  };

  const handleDeleteTodo = async (todo: TodoItem, deleteAll: boolean = true) => {
    if (todo.recurrence !== 'none' && !deleteAll) {
      const dateKey = formatDateKey(selectedDate);
      const updatedTodoData = {
        ...todo,
        excludedDates: [...(todo.excludedDates || []), dateKey],
      };
      await updateTodo(updatedTodoData);
      setTodos(todos.map(t => t.id === todo.id ? updatedTodoData : t));
    } else {
      await apiDeleteTodo(todo.id);
      setTodos(todos.filter(t => t.id !== todo.id));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = todaysTasks.findIndex((task) => task.id === active.id);
      const newIndex = todaysTasks.findIndex((task) => task.id === over.id);

      const reorderedTasks = arrayMove(todaysTasks, oldIndex, newIndex);
      
      // Assign sortOrder to all tasks for this date
      const updatedTasks = reorderedTasks.map((task, index) => ({
        ...task,
        sortOrder: index,
      }));

      // Optimistically update UI
      setTodos(todos.map(t => {
        const updatedTask = updatedTasks.find(ut => ut.id === t.id);
        return updatedTask || t;
      }));

      // Update all reordered tasks in backend
      for (const task of updatedTasks) {
        await updateTodo(task);
      }
    }
  };

  // Category management functions
  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryColor('#6366F1');
    setEditingCategory(null);
  };

  const openEditCategory = (cat: { id: string; name: string; color: string }) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryColor(cat.color);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return;

    if (editingCategory) {
      const sortOrder = categories.find(c => c.id === editingCategory.id)?.sortOrder || 0;
      await updateTodoCategory({ ...editingCategory, name: categoryName, color: categoryColor, sortOrder });
    } else {
      await saveTodoCategory({
        id: `category_${Date.now()}`,
        name: categoryName,
        color: categoryColor,
        sortOrder: categories.length,
      });
    }

    await loadCategories();
    resetCategoryForm();
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteTodoCategory(id);
    await loadCategories();
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const hasTasksOnDate = (date: Date): boolean => {
    return todos.some(todo => shouldShowOnDate(todo, date));
  };

  const getWeekDates = () => {
    const dates: Date[] = [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - 3);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  return (
    <div className="todo-page">
      {/* Header */}
      <header className="todo-header">
        <div className="header-left">
          <img src={logo} alt="Almost Adult" className="header-logo" />
          <div>
            <h1 className="header-title">Reminders</h1>
            <p className="header-subtitle">
              {isToday(selectedDate) ? 'Today' : formatDate(selectedDate)} • {todaysTasks.length} tasks
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button className="header-btn" onClick={goToToday}>Today</button>
          <button className="header-btn icon" onClick={() => setShowCalendar(!showCalendar)}>
            {showCalendar ? <IoClose size={20} /> : <IoCalendar size={20} />}
          </button>
          <button className="header-btn icon" onClick={() => categoryModal.open()}>
            <IoSettingsOutline size={20} />
          </button>
        </div>
      </header>

      {/* Calendar View */}
      {showCalendar && (
        <div className="calendar-container">
          <div className="calendar-header">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>
              <IoChevronBack size={20} />
            </button>
            <span>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>
              <IoChevronForward size={20} />
            </button>
          </div>
          <div className="calendar-weekdays">
            {DAYS.map(day => <div key={day} className="weekday">{day}</div>)}
          </div>
          <div className="calendar-days">
            {getDaysInMonth(currentMonth).map((date, i) => (
              <button
                key={i}
                className={`calendar-day ${date ? '' : 'empty'} ${date && formatDateKey(date) === formatDateKey(selectedDate) ? 'selected' : ''} ${date && isToday(date) ? 'today' : ''}`}
                onClick={() => date && setSelectedDate(date)}
                disabled={!date}
              >
                {date?.getDate()}
                {date && hasTasksOnDate(date) && <div className="day-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date Strip */}
      <div className="date-strip">
        {getWeekDates().map((date) => (
          <button
            key={date.toISOString()}
            className={`date-item ${formatDateKey(date) === formatDateKey(selectedDate) ? 'selected' : ''} ${isToday(date) ? 'today' : ''}`}
            onClick={() => setSelectedDate(date)}
          >
            <span className="date-day">{DAYS[date.getDay()]}</span>
            <span className="date-num">{date.getDate()}</span>
            {hasTasksOnDate(date) && <div className="date-dot" />}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="tasks-container">
        {isLoading ? (
          <div className="tasks-list">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-item">
                <div className="skeleton-row">
                  <div className="skeleton skeleton-circle"></div>
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text large" style={{ width: '70%' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : todaysTasks.length === 0 ? (
          <EmptyState
            icon={IoCalendarOutline}
            message="No tasks for this day"
            action={{ label: 'Add Task', icon: IoAdd, onClick: openAddModal }}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={todaysTasks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="tasks-list">
                {todaysTasks.map((todo) => {
                  const completed = isCompletedOnDate(todo, selectedDate);
                  return (
                    <SortableTaskItem
                      key={todo.id}
                      todo={todo}
                      completed={completed}
                      onToggle={() => toggleComplete(todo)}
                      onEdit={() => openEditModal(todo)}
                      onDelete={() => deleteModal.open(todo)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* FAB */}
      <FAB onClick={openAddModal} />

      {/* Add/Edit Task Modal */}
      <Modal
        isOpen={taskModal.isOpen}
        onClose={taskModal.close}
        title={taskModal.data ? 'Edit Task' : 'New Task'}
        footer={
          <ModalFooter
            onCancel={taskModal.close}
            onSubmit={handleSave}
            submitText={taskModal.data ? 'Save Changes' : 'Add Task'}
            submitDisabled={!title.trim()}
          />
        }
      >
        <FormGroup label="Title">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            autoFocus
          />
        </FormGroup>

        <FormRow>
          <FormGroup label="Date">
            <input
              type="date"
              value={taskDate}
              onChange={e => setTaskDate(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Time (optional)">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </FormGroup>
        </FormRow>

        <FormGroup label="Category (optional)">
          <div className="category-chips">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`category-chip ${category === cat.name ? 'active' : ''}`}
                onClick={() => setCategory(category === cat.name ? '' : cat.name)}
                style={{ backgroundColor: category === cat.name ? cat.color : undefined }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </FormGroup>

        <FormGroup label="Priority">
          <OptionPills options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </FormGroup>

        <FormGroup label="Repeat">
          <OptionPills options={RECURRENCE_OPTIONS} value={recurrence} onChange={setRecurrence} />
        </FormGroup>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title={deleteModal.data?.recurrence !== 'none' ? 'Delete Recurring Task' : 'Delete Task'}
      >
        {deleteModal.data?.recurrence !== 'none' ? (
          <>
            <p style={{ marginBottom: '1.5rem', color: colors.textSecondary }}>
              This is a recurring task. How would you like to delete it?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="backup-btn"
                style={{ border: `1px solid ${colors.error}`, backgroundColor: 'transparent' }}
                onClick={() => {
                  if (deleteModal.data) {
                    handleDeleteTodo(deleteModal.data, false);
                    deleteModal.close();
                  }
                }}
              >
                <IoTrash size={24} color={colors.error} />
                <div>
                  <span className="backup-btn-title" style={{ color: colors.error }}>Delete This Day Only</span>
                  <span className="backup-btn-sub">Remove from {formatDate(selectedDate)}</span>
                </div>
              </button>
              <button
                className="backup-btn"
                style={{ border: `1px solid ${colors.error}`, backgroundColor: 'transparent' }}
                onClick={() => {
                  if (deleteModal.data) {
                    handleDeleteTodo(deleteModal.data, true);
                    deleteModal.close();
                  }
                }}
              >
                <IoTrash size={24} color={colors.error} />
                <div>
                  <span className="backup-btn-title" style={{ color: colors.error }}>Delete Entire Series</span>
                  <span className="backup-btn-sub">Remove all occurrences permanently</span>
                </div>
              </button>
              <button
                className="backup-btn"
                style={{ border: `1px solid ${colors.border}`, backgroundColor: 'transparent' }}
                onClick={deleteModal.close}
              >
                <IoClose size={24} color={colors.text} />
                <div>
                  <span className="backup-btn-title">Cancel</span>
                  <span className="backup-btn-sub">Keep the task</span>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ marginBottom: '1.5rem', color: colors.textSecondary }}>
              Are you sure you want to delete "{deleteModal.data?.title}"?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="backup-btn"
                style={{ border: `1px solid ${colors.error}`, backgroundColor: 'transparent' }}
                onClick={() => {
                  if (deleteModal.data) {
                    handleDeleteTodo(deleteModal.data, true);
                    deleteModal.close();
                  }
                }}
              >
                <IoTrash size={24} color={colors.error} />
                <div>
                  <span className="backup-btn-title" style={{ color: colors.error }}>Delete Task</span>
                  <span className="backup-btn-sub">This action cannot be undone</span>
                </div>
              </button>
              <button
                className="backup-btn"
                style={{ border: `1px solid ${colors.border}`, backgroundColor: 'transparent' }}
                onClick={deleteModal.close}
              >
                <IoClose size={24} color={colors.text} />
                <div>
                  <span className="backup-btn-title">Cancel</span>
                  <span className="backup-btn-sub">Keep the task</span>
                </div>
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Category Management Modal */}
      <Modal
        isOpen={categoryModal.isOpen}
        onClose={() => { categoryModal.close(); resetCategoryForm(); }}
        title="Manage Categories"
      >
        <div className="store-settings-list">
          {categories.map(cat => (
            <div key={cat.id} className="store-settings-item">
              {editingCategory?.id === cat.id ? (
                <div className="store-edit-form">
                  <input
                    type="text"
                    value={categoryName}
                    onChange={e => setCategoryName(e.target.value)}
                    placeholder="Category name"
                    autoFocus
                  />
                  <ColorPicker
                    colors={COLOR_OPTIONS}
                    value={categoryColor}
                    onChange={setCategoryColor}
                  />
                  <div className="store-edit-actions">
                    <button className="btn secondary" onClick={resetCategoryForm}>Cancel</button>
                    <button className="btn primary" onClick={handleSaveCategory} disabled={!categoryName.trim()}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="store-info">
                    <span className="store-color" style={{ background: cat.color }} />
                    <span className="store-name">{cat.name}</span>
                  </div>
                  <div className="store-actions">
                    <button className="edit-store-btn" onClick={() => openEditCategory(cat)}>
                      <IoPencil size={16} />
                    </button>
                    <button className="delete-store-btn" onClick={() => handleDeleteCategory(cat.id)}>
                      <IoTrash size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new category */}
        {!editingCategory && (
          <div className="add-store-form">
            <input
              type="text"
              value={categoryName}
              onChange={e => setCategoryName(e.target.value)}
              placeholder="New category name"
            />
            <ColorPicker
              colors={COLOR_OPTIONS}
              value={categoryColor}
              onChange={setCategoryColor}
            />
            <button 
              className="btn primary" 
              onClick={handleSaveCategory} 
              disabled={!categoryName.trim()}
            >
              <IoAdd size={18} /> Add Category
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
