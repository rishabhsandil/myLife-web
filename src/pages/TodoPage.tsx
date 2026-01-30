import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoCalendar, IoChevronBack, IoChevronForward, IoClose,
  IoCheckmarkCircle, IoEllipseOutline, IoFlag, IoRepeat, IoTrash,
  IoCloudUpload, IoCloudDownload, IoTime, IoCalendarOutline,
  IoStar
} from 'react-icons/io5';
import { TodoItem, Priority, RecurrenceType } from '../types';
import { getTodos, saveTodo, updateTodo, deleteTodo as apiDeleteTodo, exportBackup, importBackup } from '../utils/api';
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

export default function TodoPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskDate, setTaskDate] = useState(formatDateInput(new Date()));
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [isEvent, setIsEvent] = useState(false);

  useEffect(() => {
    loadTodos();
  }, []);

  async function loadTodos() {
    const data = await getTodos();
    setTodos(data);
  }

  function formatDateInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function formatDate(date: Date): string {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
  }

  const shouldShowOnDate = (todo: TodoItem, date: Date): boolean => {
    const dateKey = formatDateKey(date);
    const todoDate = new Date(todo.date);
    const todoDateKey = formatDateKey(todoDate);

    if (todo.excludedDates?.includes(dateKey)) return false;

    if (todo.recurrence === 'none') return todoDateKey === dateKey;
    if (new Date(dateKey) < new Date(todoDateKey)) return false;

    switch (todo.recurrence) {
      case 'daily': return true;
      case 'weekly': return date.getDay() === todoDate.getDay();
      case 'monthly': return date.getDate() === todoDate.getDate();
      case 'yearly':
        return date.getDate() === todoDate.getDate() && date.getMonth() === todoDate.getMonth();
      default: return false;
    }
  };

  const isCompletedOnDate = (todo: TodoItem, date: Date): boolean => {
    const dateKey = formatDateKey(date);
    if (todo.recurrence === 'none') return todo.completed;
    return todo.completedDates?.includes(dateKey) || false;
  };

  const todaysTasks = useMemo(() => {
    return todos.filter(todo => shouldShowOnDate(todo, selectedDate));
  }, [todos, selectedDate]);

  const handleSave = async () => {
    if (!title.trim()) return;

    const todoData: TodoItem = {
      id: editingTodo?.id || Date.now().toString(),
      title: title.trim(),
      description: description.trim() || undefined,
      completed: false,
      date: taskDate,
      time: time || undefined,
      priority,
      recurrence,
      isEvent,
      completedDates: editingTodo?.completedDates || [],
      excludedDates: editingTodo?.excludedDates || [],
      createdAt: editingTodo?.createdAt || new Date().toISOString(),
    };

    if (editingTodo) {
      await updateTodo(todoData);
      setTodos(todos.map(t => t.id === editingTodo.id ? todoData : t));
    } else {
      await saveTodo(todoData);
      setTodos([...todos, todoData]);
    }

    resetForm();
    setShowAddModal(false);
    setEditingTodo(null);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTaskDate(formatDateInput(selectedDate));
    setTime('');
    setPriority('medium');
    setRecurrence('none');
    setIsEvent(false);
  };

  const toggleComplete = async (todo: TodoItem) => {
    if (todo.isEvent) return;

    const dateKey = formatDateKey(selectedDate);
    let updatedTodoData: TodoItem;

    if (todo.recurrence === 'none') {
      updatedTodoData = { ...todo, completed: !todo.completed };
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

  const editTodo = (todo: TodoItem) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description || '');
    setTaskDate(todo.date);
    setTime(todo.time || '');
    setPriority(todo.priority);
    setRecurrence(todo.recurrence);
    setIsEvent(todo.isEvent || false);
    setShowAddModal(true);
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

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const hasTasksOnDate = (date: Date): boolean => {
    return todos.some(todo => shouldShowOnDate(todo, date));
  };

  // Date strip (week view)
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const success = await importBackup(file);
      if (success) {
        setTodos(await getTodos());
        setShowBackupModal(false);
        alert('Backup restored successfully!');
      } else {
        alert('Invalid backup file');
      }
    }
  };

  return (
    <div className="todo-page">
      {/* Header */}
      <header className="todo-header">
        <div className="header-left">
          <img src={logo} alt="MyLife" className="header-logo" />
          <div>
            <h1 className="header-title">MyLife</h1>
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
          <button className="header-btn icon" onClick={() => setShowBackupModal(true)}>
            <IoCloudUpload size={20} />
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
        {todaysTasks.length === 0 ? (
          <div className="empty-state">
            <IoCalendarOutline size={48} color={colors.textMuted} />
            <p>No tasks for this day</p>
            <button className="add-task-btn" onClick={() => { resetForm(); setShowAddModal(true); }}>
              <IoAdd size={20} /> Add Task
            </button>
          </div>
        ) : (
          <div className="tasks-list">
            {todaysTasks.map((todo) => {
              const completed = isCompletedOnDate(todo, selectedDate);
              return (
                <div key={todo.id} className={`task-item ${completed ? 'completed' : ''}`}>
                  <button
                    className="task-checkbox"
                    onClick={() => toggleComplete(todo)}
                    disabled={todo.isEvent}
                  >
                    {todo.isEvent ? (
                      <IoStar size={24} color={colors.warning} />
                    ) : completed ? (
                      <IoCheckmarkCircle size={24} color={colors.success} />
                    ) : (
                      <IoEllipseOutline size={24} color={colors.textMuted} />
                    )}
                  </button>
                  <div className="task-content" onClick={() => editTodo(todo)}>
                    <div className="task-title-row">
                      <span className="task-title">{todo.title}</span>
                      <div className="task-badges">
                        {todo.recurrence !== 'none' && (
                          <span className="badge recurrence"><IoRepeat size={12} /></span>
                        )}
                        <span className={`badge priority ${todo.priority}`}>
                          <IoFlag size={12} />
                        </span>
                      </div>
                    </div>
                    {todo.description && <p className="task-desc">{todo.description}</p>}
                    {todo.time && (
                      <span className="task-time"><IoTime size={12} /> {todo.time}</span>
                    )}
                  </div>
                  <button className="task-delete" onClick={() => {
                    if (todo.recurrence !== 'none') {
                      if (confirm('Delete all occurrences? Click OK for all, Cancel for just this day.')) {
                        handleDeleteTodo(todo, true);
                      } else {
                        handleDeleteTodo(todo, false);
                      }
                    } else {
                      handleDeleteTodo(todo, true);
                    }
                  }}>
                    <IoTrash size={18} color={colors.error} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => { resetForm(); setShowAddModal(true); }}>
        <IoAdd size={28} />
      </button>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingTodo(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTodo ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingTodo(null); }}>
                <IoClose size={24} color={colors.textSecondary} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add more details..."
                  rows={2}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={taskDate}
                    onChange={e => setTaskDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Time (optional)</label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Priority</label>
                <div className="option-pills">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      className={`pill ${priority === opt.key ? 'active' : ''}`}
                      style={{ '--pill-color': opt.color } as React.CSSProperties}
                      onClick={() => setPriority(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Repeat</label>
                <div className="option-pills">
                  {RECURRENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      className={`pill ${recurrence === opt.key ? 'active' : ''}`}
                      onClick={() => setRecurrence(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isEvent}
                    onChange={e => setIsEvent(e.target.checked)}
                  />
                  <span>Event (no completion needed, e.g., birthdays)</span>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn secondary" onClick={() => { setShowAddModal(false); setEditingTodo(null); }}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSave} disabled={!title.trim()}>
                {editingTodo ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Modal */}
      {showBackupModal && (
        <div className="modal-overlay" onClick={() => setShowBackupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Backup & Restore</h2>
              <button onClick={() => setShowBackupModal(false)}>
                <IoClose size={24} color={colors.textSecondary} />
              </button>
            </div>

            <div className="modal-body">
              <p className="backup-info">
                Your data is saved locally in your browser. Use backup to transfer data or keep a copy safe.
              </p>

              <button className="backup-btn" onClick={() => { exportBackup(); setShowBackupModal(false); }}>
                <IoCloudDownload size={24} />
                <div>
                  <span className="backup-btn-title">Export Backup</span>
                  <span className="backup-btn-sub">Download your data as a file</span>
                </div>
              </button>

              <label className="backup-btn">
                <IoCloudUpload size={24} />
                <div>
                  <span className="backup-btn-title">Restore from Backup</span>
                  <span className="backup-btn-sub">Import a backup file</span>
                </div>
                <input type="file" accept=".json" onChange={handleImport} hidden />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
