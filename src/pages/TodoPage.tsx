import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoCalendar, IoChevronBack, IoChevronForward, IoClose,
  IoCheckmarkCircle, IoEllipseOutline, IoRepeat, IoTrash,
  IoTime, IoCalendarOutline, IoPencil, IoReorderTwo, IoSettingsOutline, IoPersonAdd
} from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
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
import { getTodos, saveTodo, updateTodo, deleteTodo as apiDeleteTodo, getTodoCategories, saveTodoCategory, updateTodoCategory, deleteTodoCategory, getConnections, UserConnection } from '../utils/api.ts';
import { Modal, ModalFooter, FormGroup, FormRow, OptionPills, ColorPicker, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
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
  currentUserId?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableTaskItem({ todo, completed, currentUserId, onToggle, onEdit, onDelete }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: todo.id });

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
        // Call delete and reset immediately - modal will handle confirmation
        onDelete();
        // Reset after a short delay to allow modal to open
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
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`task-item ${completed ? 'completed' : ''} ${todo.overdue && !completed ? 'overdue' : ''}`}
    >
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div className="task-item-content" style={contentStyle} {...swipeHandlers}>
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
        >
          <IoReorderTwo size={18} color={colors.textMuted} />
        </button>
        <button
          className="task-checkbox"
          onClick={onToggle}
        >
          {completed ? (
            <IoCheckmarkCircle size={22} color={colors.success} />
          ) : (
            <IoEllipseOutline size={22} color={colors.textMuted} />
          )}
        </button>
        <div className="task-content" onClick={onEdit}>
        <span className="task-title">{todo.title}</span>
        <div className="task-info">
          {(todo.time || todo.category || todo.recurrence !== 'none' || (todo.overdue && !completed)) && (
            <div className="task-meta">
              {todo.time && <span><IoTime size={11} /> {todo.time}</span>}
              {todo.category && <span className="task-category">{todo.category}</span>}
              {todo.recurrence !== 'none' && <span title="Recurring"><IoRepeat size={11} /></span>}
              {todo.overdue && !completed && (
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
      </div>
    </div>
  );
}

export default function TodoPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string; sortOrder: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  
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
  
  // Assignment state
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<{ id: string; name: string; email: string } | null>(null);

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
    loadConnections();
  }, []);

  async function loadCategories() {
    const data = await getTodoCategories();
    setCategories(data);
  }

  async function loadConnections() {
    const data = await getConnections();
    setConnections(data);
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

  const overdueTasks = useMemo(() => {
    const selectedStr = formatDateKey(selectedDate);
    
    return todaysTasks.filter(todo => {
      if (isCompletedOnDate(todo, selectedDate)) return false;
      const todoDateStr = todo.date.split('T')[0];
      // Task is overdue if its date is before the selected date
      return todoDateStr < selectedStr;
    });
  }, [todaysTasks, selectedDate]);

  const incompleteTasks = useMemo(() => {
    const selectedStr = formatDateKey(selectedDate);
    
    return todaysTasks.filter(todo => {
      if (isCompletedOnDate(todo, selectedDate)) return false;
      const todoDateStr = todo.date.split('T')[0];
      // Task is for today (not overdue)
      return todoDateStr >= selectedStr;
    });
  }, [todaysTasks, selectedDate]);

  const completedTasks = useMemo(() => {
    return todaysTasks.filter(todo => isCompletedOnDate(todo, selectedDate));
  }, [todaysTasks, selectedDate]);

  const resetForm = () => {
    setTitle('');
    setTaskDate(formatDateInput(selectedDate));
    setTime('');
    setPriority('medium');
    setCategory('');
    setRecurrence('none');
    setSelectedAssignee(null);
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
    
    // Load assignee if exists
    if (todo.assignedToUserId && todo.assigneeName && todo.assigneeEmail) {
      setSelectedAssignee({
        id: todo.assignedToUserId,
        name: todo.assigneeName,
        email: todo.assigneeEmail,
      });
    } else {
      setSelectedAssignee(null);
    }
    
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
      assignedToUserId: selectedAssignee?.id || undefined,
      assigneeName: selectedAssignee?.name || undefined,
      assigneeEmail: selectedAssignee?.email || undefined,
      // Preserve additional properties when editing
      overdue: taskModal.data?.overdue,
      originalDate: taskModal.data?.originalDate,
      sortOrder: taskModal.data?.sortOrder,
      ownerId: taskModal.data?.ownerId,
      ownerName: taskModal.data?.ownerName,
      ownerEmail: taskModal.data?.ownerEmail,
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

  // Assignment functions
  const handleAssigneeChange = (userId: string) => {
    if (!userId) {
      setSelectedAssignee(null);
    } else {
      const connection = connections.find(c => c.id === userId);
      if (connection) {
        setSelectedAssignee({
          id: connection.id,
          name: connection.name,
          email: connection.email,
        });
      }
    }
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
          <>
            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <div className="overdue-section">
                <div className="section-label overdue-label">
                  <span>Overdue ({overdueTasks.length})</span>
                </div>
                <div className="tasks-list">
                  {overdueTasks.map((todo) => (
                    <SortableTaskItem
                      key={todo.id}
                      todo={todo}
                      completed={false}
                      currentUserId={user?.id}
                      onToggle={() => toggleComplete(todo)}
                      onEdit={() => openEditModal(todo)}
                      onDelete={() => deleteModal.open(todo)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Incomplete Tasks (Today's tasks) */}
            {incompleteTasks.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={incompleteTasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="tasks-list">
                    {incompleteTasks.map((todo) => (
                      <SortableTaskItem
                        key={todo.id}
                        todo={todo}
                        completed={false}
                        currentUserId={user?.id}
                        onToggle={() => toggleComplete(todo)}
                        onEdit={() => openEditModal(todo)}
                        onDelete={() => deleteModal.open(todo)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="completed-section">
                <button 
                  className="completed-header"
                  onClick={() => setShowCompletedTasks(!showCompletedTasks)}
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
                    {completedTasks.map((todo) => (
                      <SortableTaskItem
                        key={todo.id}
                        todo={todo}
                        completed={true}
                        currentUserId={user?.id}
                        onToggle={() => toggleComplete(todo)}
                        onEdit={() => openEditModal(todo)}
                        onDelete={() => deleteModal.open(todo)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
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

        <FormGroup label="Assign to (optional)">
          <select
            value={selectedAssignee?.id || ''}
            onChange={e => handleAssigneeChange(e.target.value)}
            className="assignee-select"
          >
            <option value="">Not assigned</option>
            {connections.map(conn => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.email})
              </option>
            ))}
          </select>
          {connections.length === 0 && (
            <p className="assignee-hint">Add connections in Settings to assign tasks</p>
          )}
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
