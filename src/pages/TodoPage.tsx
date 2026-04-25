import { useState, useEffect, useMemo } from 'react';
import { IoCalendar, IoClose, IoSettingsOutline } from '../utils/icons';
import { arrayMove } from '@dnd-kit/sortable';
import { DragEndEvent } from '@dnd-kit/core';
import { TodoItem } from '../types';
import {
  getTodos, saveTodo, updateTodo, deleteTodo as apiDeleteTodo,
  getTodoCategories, saveTodoCategory, updateTodoCategory, deleteTodoCategory,
  getConnections, UserConnection,
} from '../utils/api.ts';
import { Modal, ModalFooter, FAB } from '../components';
import { useToast } from '../components/Toast';
import { useModal } from '../hooks';
import { useAuth } from '../contexts/AuthContext.tsx';
import logo from '../assets/logo.png';
import {
  formatDate, formatDateKey, isToday,
  shouldShowOnDate, isCompletedOnDate,
} from './todo/todoHelpers';
import { TaskFormModal } from './todo/TaskFormModal';
import { CategoryManagementModal } from './todo/CategoryManagementModal';
import { DeleteTaskModal } from './todo/DeleteTaskModal';
import { CalendarHeader } from './todo/CalendarHeader';
import { ScheduleView } from './todo/ScheduleView';
import { BacklogView } from './todo/BacklogView';
import { CategoryView } from './todo/CategoryView';
import './todo/TodoPage.css';

interface Category { id: string; name: string; color: string; sortOrder: number }

export default function TodoPage() {
  const { user } = useAuth();
  const { showError } = useToast();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [activeView, setActiveView] = useState<'schedule' | 'backlog' | 'categories'>('schedule');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [forceBacklog, setForceBacklog] = useState(false);
  const [initialBacklogMonth, setInitialBacklogMonth] = useState('');

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() => {
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const collapsed = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (key !== currentMonthKey) collapsed.add(key);
    }
    return collapsed;
  });

  const taskModal = useModal<TodoItem>();
  const deleteModal = useModal<TodoItem>();
  const categoryModal = useModal();
  const deleteCategoryModal = useModal<{ id: string; name: string; color: string }>();

  useEffect(() => {
    const ac = new AbortController();
    void loadAll(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll(signal?: AbortSignal) {
    setIsLoading(true);
    try {
      const [todoData, categoryData, connectionData] = await Promise.all([
        getTodos(signal),
        getTodoCategories(signal),
        getConnections(signal),
      ]);
      setTodos(todoData);
      setCategories(categoryData);
      setConnections(connectionData);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(err, 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }

  // Carry forward overdue tasks
  useEffect(() => {
    const checkOverdueTasks = async () => {
      const today = formatDateKey(new Date());
      let hasUpdates = false;
      const updatedTodos = todos.map(todo => {
        if (todo.completed || !todo.date || todo.date === 'backlog') return todo;
        if (todo.recurrence !== 'none') return todo;
        if (todo.date < today) {
          hasUpdates = true;
          return {
            ...todo,
            originalDate: todo.originalDate || todo.date,
            date: today,
            overdue: true,
          };
        }
        if (todo.date === today) {
          if (todo.originalDate && todo.originalDate < today && !todo.overdue) {
            hasUpdates = true;
            return { ...todo, overdue: true };
          }
          return todo;
        }
        if (todo.date > today && (todo.overdue || todo.originalDate)) {
          hasUpdates = true;
          return { ...todo, overdue: false, originalDate: undefined };
        }
        return todo;
      });

      if (hasUpdates) {
        const previousTodos = todos;
        setTodos(updatedTodos);
        try {
          for (const todo of updatedTodos) {
            if (todo.recurrence !== 'none') continue;
            const originalTodo = todos.find(t => t.id === todo.id);
            if (!originalTodo || originalTodo.recurrence !== 'none') continue;
            if (todo.overdue !== originalTodo.overdue || todo.date !== originalTodo.date || todo.originalDate !== originalTodo.originalDate) {
              await updateTodo(todo);
            }
          }
        } catch (err) {
          setTodos(previousTodos);
          showError(err, 'Failed to update overdue tasks');
        }
      }
    };

    if (todos.length > 0) checkOverdueTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos.length]);

  const todaysTasks = useMemo(() => {
    return todos
      .filter(todo => shouldShowOnDate(todo, selectedDate))
      .sort((a, b) => {
        const aCompleted = isCompletedOnDate(a, selectedDate);
        const bCompleted = isCompletedOnDate(b, selectedDate);
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
        const selectedStr = formatDateKey(selectedDate);
        const aOverdue = !aCompleted && a.recurrence === 'none' && (a.overdue || a.date.split('T')[0] < selectedStr);
        const bOverdue = !bCompleted && b.recurrence === 'none' && (b.overdue || b.date.split('T')[0] < selectedStr);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
      });
  }, [todos, selectedDate]);

  const overdueTasks = useMemo(() => {
    const selectedStr = formatDateKey(selectedDate);
    return todaysTasks.filter(todo => {
      if (isCompletedOnDate(todo, selectedDate)) return false;
      if (todo.recurrence !== 'none') return false;
      if (todo.overdue) return true;
      const todoDateStr = todo.date.split('T')[0];
      if (todoDateStr < selectedStr) return true;
      return false;
    });
  }, [todaysTasks, selectedDate]);

  const incompleteTasks = useMemo(() => {
    const selectedStr = formatDateKey(selectedDate);
    return todaysTasks.filter(todo => {
      if (isCompletedOnDate(todo, selectedDate)) return false;
      if (todo.recurrence !== 'none') return true;
      if (todo.overdue) return false;
      const todoDateStr = todo.date.split('T')[0];
      if (todoDateStr < selectedStr) return false;
      return true;
    });
  }, [todaysTasks, selectedDate]);

  const completedTasks = useMemo(() => {
    return todaysTasks.filter(todo => isCompletedOnDate(todo, selectedDate));
  }, [todaysTasks, selectedDate]);

  const backlogTasksByMonth = useMemo(() => {
    const today = new Date();
    const monthKeys: { display: string; key: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const display = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push({ display, key });
    }
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const unscheduledTasks = todos
      .filter(todo => !todo.date || todo.date === 'backlog')
      .filter(todo => !todo.completed);
    const grouped: { [key: string]: TodoItem[] } = {};
    monthKeys.forEach(({ key }) => { grouped[key] = []; });
    unscheduledTasks.forEach(task => {
      const monthKey = task.backlogMonth || currentMonthKey;
      if (grouped[monthKey]) grouped[monthKey].push(task);
    });
    monthKeys.forEach(({ key }) => {
      grouped[key].sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    return monthKeys.map(({ display, key }) => ({ month: display, monthKey: key, tasks: grouped[key] }));
  }, [todos]);

  const backlogTasks = useMemo(
    () => backlogTasksByMonth.flatMap(g => g.tasks),
    [backlogTasksByMonth]
  );

  const categoryTasks = useMemo(() => {
    if (!selectedCategory) return [];
    const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name;
    if (!selectedCategoryName) return [];
    const today = formatDateKey(new Date());
    return todos
      .filter(todo => todo.category === selectedCategoryName && !todo.completed)
      .filter(todo => {
        if (todo.date && todo.date !== 'backlog') return todo.date >= today;
        return true;
      })
      .sort((a, b) => {
        if (a.date === 'backlog' && b.date !== 'backlog') return 1;
        if (b.date === 'backlog' && a.date !== 'backlog') return -1;
        if (a.date && b.date) return a.date.localeCompare(b.date);
        return 0;
      });
  }, [todos, selectedCategory, categories]);

  const openAddModal = () => {
    setForceBacklog(activeView === 'backlog');
    setInitialBacklogMonth('');
    taskModal.open();
  };
  const openAddModalForMonth = (monthKey: string) => {
    setForceBacklog(true);
    setInitialBacklogMonth(monthKey);
    taskModal.open();
  };
  const openEditModal = (todo: TodoItem) => {
    setForceBacklog(false);
    setInitialBacklogMonth('');
    taskModal.open(todo);
  };

  const handleSaveTodo = async (todoData: TodoItem) => {
    const isEdit = !!taskModal.data;
    const previousTodos = todos;
    if (isEdit) {
      setTodos(todos.map(t => t.id === todoData.id ? todoData : t));
    } else {
      setTodos([...todos, todoData]);
    }
    taskModal.close();
    try {
      if (isEdit) await updateTodo(todoData);
      else await saveTodo(todoData);
    } catch (err) {
      setTodos(previousTodos);
      showError(err, isEdit ? 'Failed to update task' : 'Failed to add task');
    }
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
        overdue: isCompleting ? false : (todo.originalDate ? true : todo.date < today),
      };
    } else {
      const isCompleted = todo.completedDates.includes(dateKey);
      updatedTodoData = {
        ...todo,
        completedDates: isCompleted
          ? todo.completedDates.filter(d => d !== dateKey)
          : [...todo.completedDates, dateKey],
      };
    }

    const previousTodos = todos;
    setTodos(todos.map(t => t.id === todo.id ? updatedTodoData : t));
    try {
      await updateTodo(updatedTodoData);
    } catch (err) {
      setTodos(previousTodos);
      showError(err, 'Failed to update task');
    }
  };

  const handleDeleteTodo = async (todo: TodoItem, deleteAll: boolean = true) => {
    const previousTodos = todos;
    if (todo.recurrence !== 'none' && !deleteAll) {
      const dateKey = formatDateKey(selectedDate);
      const updatedTodoData: TodoItem = {
        ...todo,
        excludedDates: [...todo.excludedDates, dateKey],
      };
      setTodos(todos.map(t => t.id === todo.id ? updatedTodoData : t));
      try {
        await updateTodo(updatedTodoData);
      } catch (err) {
        setTodos(previousTodos);
        showError(err, 'Failed to skip task');
      }
    } else {
      setTodos(todos.filter(t => t.id !== todo.id));
      try {
        await apiDeleteTodo(todo.id);
      } catch (err) {
        setTodos(previousTodos);
        showError(err, 'Failed to delete task');
      }
    }
  };

  const toggleMonthCollapsed = (monthKey: string) => {
    setCollapsedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) newSet.delete(monthKey);
      else newSet.add(monthKey);
      return newSet;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = incompleteTasks.findIndex(task => task.id === active.id);
      const newIndex = incompleteTasks.findIndex(task => task.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reorderedTasks = arrayMove(incompleteTasks, oldIndex, newIndex);
      const updatedTasks = reorderedTasks.map((task, index) => ({ ...task, sortOrder: index }));
      const previousTodos = todos;
      setTodos(todos.map(t => updatedTasks.find(ut => ut.id === t.id) || t));
      try {
        for (const task of updatedTasks) await updateTodo(task);
      } catch (err) {
        setTodos(previousTodos);
        showError(err, 'Failed to reorder tasks');
      }
    }
  };

  const handleBacklogDragEnd = async (event: DragEndEvent, monthKey: string) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const monthTasks = backlogTasksByMonth.find(g => g.monthKey === monthKey)?.tasks || [];
      const oldIndex = monthTasks.findIndex(task => task.id === active.id);
      const newIndex = monthTasks.findIndex(task => task.id === over.id);
      const reorderedTasks = arrayMove(monthTasks, oldIndex, newIndex);
      const updatedTasks = reorderedTasks.map((task, index) => ({ ...task, sortOrder: index }));
      const previousTodos = todos;
      setTodos(todos.map(t => updatedTasks.find(ut => ut.id === t.id) || t));
      try {
        for (const task of updatedTasks) await updateTodo(task);
      } catch (err) {
        setTodos(previousTodos);
        showError(err, 'Failed to reorder tasks');
      }
    }
  };

  const handleSaveCategory = async (
    values: { editing: { id: string; name: string; color: string } | null; name: string; color: string }
  ) => {
    const previousCategories = categories;
    if (values.editing) {
      const sortOrder = categories.find(c => c.id === values.editing!.id)?.sortOrder || 0;
      const updated: Category = { ...values.editing, name: values.name, color: values.color, sortOrder };
      setCategories(categories.map(c => c.id === updated.id ? updated : c));
      try { await updateTodoCategory(updated); }
      catch (err) { setCategories(previousCategories); showError(err, 'Failed to update category'); }
    } else {
      const newCategory: Category = {
        id: `category_${Date.now()}`,
        name: values.name,
        color: values.color,
        sortOrder: categories.length,
      };
      setCategories([...categories, newCategory]);
      try { await saveTodoCategory(newCategory); }
      catch (err) { setCategories(previousCategories); showError(err, 'Failed to add category'); }
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const previousCategories = categories;
    setCategories(categories.filter(c => c.id !== id));
    try {
      await deleteTodoCategory(id);
    } catch (err) {
      setCategories(previousCategories);
      showError(err, 'Failed to delete category');
    }
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const headerSubtitle =
    activeView === 'schedule'
      ? `${isToday(selectedDate) ? 'Today' : formatDate(selectedDate)} • ${todaysTasks.length} tasks`
      : activeView === 'backlog'
      ? `Backlog • ${backlogTasks.length} tasks`
      : selectedCategory
      ? `${categories.find(c => c.id === selectedCategory)?.name || 'Category'} • ${categoryTasks.length} tasks`
      : 'Select a category';

  return (
    <div className="todo-page">
      <header className="todo-header">
        <div className="header-left">
          <img src={logo} alt="Almost Adult" className="header-logo" />
          <div>
            <h1 className="header-title">Reminders</h1>
            <p className="header-subtitle">{headerSubtitle}</p>
          </div>
        </div>
        <div className="header-actions">
          {activeView === 'schedule' && (
            <>
              <button className="header-btn" onClick={goToToday}>Today</button>
              <button className="header-btn icon" onClick={() => setShowCalendar(!showCalendar)}>
                {showCalendar ? <IoClose size={20} /> : <IoCalendar size={20} />}
              </button>
            </>
          )}
          <button className="header-btn icon" onClick={() => categoryModal.open()}>
            <IoSettingsOutline size={20} />
          </button>
        </div>
      </header>

      <div className="view-tabs">
        <button
          className={`view-tab ${activeView === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveView('schedule')}
        >
          Schedule
        </button>
        <button
          className={`view-tab ${activeView === 'backlog' ? 'active' : ''}`}
          onClick={() => setActiveView('backlog')}
        >
          Backlog
        </button>
        <button
          className={`view-tab ${activeView === 'categories' ? 'active' : ''}`}
          onClick={() => {
            setActiveView('categories');
            if (!selectedCategory && categories.length > 0) {
              setSelectedCategory(categories[0].id);
            }
          }}
        >
          Categories
        </button>
      </div>

      {activeView === 'schedule' && (
        <CalendarHeader
          todos={todos}
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          showCalendar={showCalendar}
          onSelectDate={setSelectedDate}
          onChangeMonth={setCurrentMonth}
        />
      )}

      <div className="tasks-container">
        {isLoading ? (
          <div className="tasks-list">
            {[1, 2, 3, 4].map(i => (
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
        ) : activeView === 'categories' ? (
          <CategoryView
            categories={categories}
            selectedCategory={selectedCategory}
            categoryTasks={categoryTasks}
            currentUserId={user?.id}
            onSelectCategory={setSelectedCategory}
            onAddTask={openAddModal}
            onToggleTask={toggleComplete}
            onEditTask={openEditModal}
            onDeleteTask={(t) => deleteModal.open(t)}
          />
        ) : activeView === 'backlog' ? (
          <BacklogView
            groups={backlogTasksByMonth}
            collapsedMonths={collapsedMonths}
            currentUserId={user?.id}
            onToggleCollapsed={toggleMonthCollapsed}
            onAddForMonth={openAddModalForMonth}
            onToggleTask={toggleComplete}
            onEditTask={openEditModal}
            onDeleteTask={(t) => deleteModal.open(t)}
            onDragEnd={handleBacklogDragEnd}
          />
        ) : (
          <ScheduleView
            todaysTasksLength={todaysTasks.length}
            overdueTasks={overdueTasks}
            incompleteTasks={incompleteTasks}
            completedTasks={completedTasks}
            showCompletedTasks={showCompletedTasks}
            currentUserId={user?.id}
            onSetShowCompletedTasks={setShowCompletedTasks}
            onAddTask={openAddModal}
            onToggleTask={toggleComplete}
            onEditTask={openEditModal}
            onDeleteTask={(t) => deleteModal.open(t)}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>

      <FAB onClick={openAddModal} />

      <TaskFormModal
        isOpen={taskModal.isOpen}
        editingTask={taskModal.data ?? null}
        selectedDate={selectedDate}
        forceBacklog={forceBacklog}
        initialBacklogMonth={initialBacklogMonth}
        categories={categories}
        connections={connections}
        backlogMonths={backlogTasksByMonth.map(g => ({ monthKey: g.monthKey, month: g.month }))}
        onClose={taskModal.close}
        onSubmit={handleSaveTodo}
      />

      <DeleteTaskModal
        isOpen={deleteModal.isOpen}
        task={deleteModal.data ?? null}
        selectedDate={selectedDate}
        onClose={deleteModal.close}
        onDelete={handleDeleteTodo}
      />

      <CategoryManagementModal
        isOpen={categoryModal.isOpen}
        onClose={categoryModal.close}
        categories={categories}
        onSaveCategory={handleSaveCategory}
        onRequestDeleteCategory={(c) => deleteCategoryModal.open(c)}
      />

      <Modal
        isOpen={deleteCategoryModal.isOpen}
        onClose={deleteCategoryModal.close}
        title="Delete Category"
        footer={
          <ModalFooter
            onCancel={deleteCategoryModal.close}
            onSubmit={() => {
              if (deleteCategoryModal.data) {
                handleDeleteCategory(deleteCategoryModal.data.id);
                deleteCategoryModal.close();
              }
            }}
            submitText="Delete"
            submitDestructive={true}
          />
        }
      >
        <p>Are you sure you want to delete this category?</p>
        {deleteCategoryModal.data && (
          <>
            <p><strong>{deleteCategoryModal.data.name}</strong></p>
            <p>Tasks with this category will not be deleted, but will lose their category assignment.</p>
          </>
        )}
      </Modal>
    </div>
  );
}
