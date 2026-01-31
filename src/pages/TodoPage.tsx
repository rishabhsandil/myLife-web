import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoCalendar, IoChevronBack, IoChevronForward, IoClose,
  IoCheckmarkCircle, IoEllipseOutline, IoFlag, IoRepeat, IoTrash,
  IoCloudUpload, IoCloudDownload, IoTime, IoCalendarOutline,
  IoStar
} from 'react-icons/io5';
import { TodoItem, Priority, RecurrenceType } from '../types';
import { getTodos, saveTodo, updateTodo, deleteTodo as apiDeleteTodo, exportBackup, importBackup } from '../utils/api.ts';
import { Modal, ModalFooter, FormGroup, FormRow, OptionPills, FAB, EmptyState } from '../components';
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

// Date helper functions
const formatDateInput = (date: Date): string => date.toISOString().split('T')[0];
const formatDateKey = (date: Date): string => date.toISOString().split('T')[0];
const formatDate = (date: Date): string => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
const isToday = (date: Date): boolean => formatDateKey(date) === formatDateKey(new Date());

export default function TodoPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  
  const taskModal = useModal<TodoItem>();
  const backupModal = useModal();

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

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTaskDate(formatDateInput(selectedDate));
    setTime('');
    setPriority('medium');
    setRecurrence('none');
    setIsEvent(false);
  };

  const openAddModal = () => {
    resetForm();
    taskModal.open();
  };

  const openEditModal = (todo: TodoItem) => {
    setTitle(todo.title);
    setDescription(todo.description || '');
    setTaskDate(todo.date);
    setTime(todo.time || '');
    setPriority(todo.priority);
    setRecurrence(todo.recurrence);
    setIsEvent(todo.isEvent || false);
    taskModal.open(todo);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const todoData: TodoItem = {
      id: taskModal.data?.id || Date.now().toString(),
      title: title.trim(),
      description: description.trim() || undefined,
      completed: false,
      date: taskDate,
      time: time || undefined,
      priority,
      recurrence,
      isEvent,
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const success = await importBackup(file);
      if (success) {
        setTodos(await getTodos());
        backupModal.close();
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
          <button className="header-btn icon" onClick={() => backupModal.open()}>
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
          <EmptyState
            icon={IoCalendarOutline}
            message="No tasks for this day"
            action={{ label: 'Add Task', icon: IoAdd, onClick: openAddModal }}
          />
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
                  <div className="task-content" onClick={() => openEditModal(todo)}>
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

        <FormGroup label="Description (optional)">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add more details..."
            rows={2}
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

        <FormGroup label="Priority">
          <OptionPills options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </FormGroup>

        <FormGroup label="Repeat">
          <OptionPills options={RECURRENCE_OPTIONS} value={recurrence} onChange={setRecurrence} />
        </FormGroup>

        <FormGroup label="">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isEvent}
              onChange={e => setIsEvent(e.target.checked)}
            />
            <span>Event (no completion needed, e.g., birthdays)</span>
          </label>
        </FormGroup>
      </Modal>

      {/* Backup Modal */}
      <Modal
        isOpen={backupModal.isOpen}
        onClose={backupModal.close}
        title="Backup & Restore"
      >
        <p className="backup-info">
          Your data is saved locally in your browser. Use backup to transfer data or keep a copy safe.
        </p>

        <button className="backup-btn" onClick={() => { exportBackup(); backupModal.close(); }}>
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
      </Modal>
    </div>
  );
}
