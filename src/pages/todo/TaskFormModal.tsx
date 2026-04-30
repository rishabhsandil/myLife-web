import { useState, useEffect } from 'react';
import { IoClose } from '../../utils/icons';
import { TodoItem, Priority, RecurrenceType } from '../../types';
import { Modal, ModalFooter, FormGroup, FormRow, OptionPills } from '../../components';
import { UserConnection } from '../../utils/api';
import {
  RECURRENCE_OPTIONS, DAY_LABELS, DAY_NAMES, PRIORITY_OPTIONS,
} from './todoConstants';
import { formatDateInput } from './todoHelpers';

interface BacklogMonthOption {
  monthKey: string;
  month: string;
}

interface TaskFormModalProps {
  isOpen: boolean;
  editingTask: TodoItem | null;
  selectedDate: Date;
  forceBacklog: boolean;
  initialBacklogMonth: string;
  categories: { id: string; name: string; color: string }[];
  connections: UserConnection[];
  backlogMonths: BacklogMonthOption[];
  onClose: () => void;
  onSubmit: (todo: TodoItem) => void;
}

export function TaskFormModal({
  isOpen, editingTask, selectedDate, forceBacklog, initialBacklogMonth,
  categories, connections, backlogMonths, onClose, onSubmit,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [isBacklogTask, setIsBacklogTask] = useState(false);
  const [backlogMonthSelection, setBacklogMonthSelection] = useState('');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<{ id: string; name: string; email: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTask) {
      setTitle(editingTask.title);
      const isBacklog = !editingTask.date || editingTask.date === 'backlog' || editingTask.date.startsWith('backlog-');
      setTaskDate(isBacklog ? '' : editingTask.date);
      setIsBacklogTask(isBacklog);
      setBacklogMonthSelection(editingTask.backlogMonth || '');
      setTime(editingTask.time || '');
      setPriority(editingTask.priority);
      setCategory(editingTask.category || '');
      setRecurrence(editingTask.recurrence);
      setRecurrenceDays(editingTask.recurrence !== 'none' ? (editingTask.recurrenceDays || []) : []);
      if (editingTask.assignedToUserId && editingTask.assigneeName && editingTask.assigneeEmail) {
        setSelectedAssignee({
          id: editingTask.assignedToUserId,
          name: editingTask.assigneeName,
          email: editingTask.assigneeEmail,
        });
      } else {
        setSelectedAssignee(null);
      }
    } else {
      setTitle('');
      setIsBacklogTask(forceBacklog);
      setTaskDate(forceBacklog ? '' : formatDateInput(selectedDate));
      setBacklogMonthSelection(initialBacklogMonth || '');
      setTime('');
      setPriority('medium');
      setCategory('');
      setRecurrence('none');
      setRecurrenceDays([]);
      setSelectedAssignee(null);
    }
  }, [isOpen, editingTask, forceBacklog, initialBacklogMonth, selectedDate]);

  const handleAssigneeChange = (userId: string) => {
    if (!userId) {
      setSelectedAssignee(null);
      return;
    }
    const conn = connections.find(c => c.id === userId);
    if (conn) setSelectedAssignee({ id: conn.id, name: conn.name, email: conn.email });
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    // Backlog items can be recurring, but only the 'custom' (day-of-week)
    // option makes sense without a base date. Coerce anything else to 'none'.
    const finalRecurrence: RecurrenceType = isBacklogTask
      ? (recurrence === 'custom' ? 'custom' : 'none')
      : recurrence;
    const editingRecurring = editingTask && editingTask.recurrence !== 'none' ? editingTask : null;
    const editingBasic = editingTask && editingTask.recurrence === 'none' ? editingTask : null;
    const dateChanged = !!(editingTask && taskDate !== editingTask.date);

    const baseFields = {
      id: editingTask?.id || Date.now().toString(),
      title: title.trim(),
      completed: false,
      date: isBacklogTask ? 'backlog' : taskDate,
      time: time || undefined,
      priority,
      category: category || undefined,
      createdAt: editingTask?.createdAt || new Date().toISOString(),
      assignedToUserId: selectedAssignee?.id || undefined,
      assigneeName: selectedAssignee?.name || undefined,
      assigneeEmail: selectedAssignee?.email || undefined,
      backlogMonth: isBacklogTask ? backlogMonthSelection || undefined : undefined,
      sortOrder: editingTask?.sortOrder,
      ownerId: editingTask?.ownerId,
      ownerName: editingTask?.ownerName,
      ownerEmail: editingTask?.ownerEmail,
    };

    const todoData: TodoItem = finalRecurrence === 'none'
      ? {
          ...baseFields,
          recurrence: 'none',
          overdue: dateChanged ? false : editingBasic?.overdue,
          originalDate: dateChanged ? undefined : editingBasic?.originalDate,
        }
      : {
          ...baseFields,
          recurrence: finalRecurrence,
          recurrenceDays: finalRecurrence === 'custom' ? recurrenceDays : undefined,
          completedDates: editingRecurring?.completedDates || [],
          excludedDates: editingRecurring?.excludedDates || [],
        };
    onSubmit(todoData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTask ? 'Edit Task' : 'New Task'}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitText={editingTask ? 'Save Changes' : 'Add Task'}
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
            onChange={e => {
              setTaskDate(e.target.value);
              setIsBacklogTask(!e.target.value);
            }}
            disabled={isBacklogTask}
          />
        </FormGroup>
        <FormGroup label="Time (optional)">
          <div className="time-input-wrapper">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              disabled={isBacklogTask}
            />
            {time && !isBacklogTask && (
              <button
                type="button"
                className="time-clear-btn"
                onClick={() => setTime('')}
                aria-label="Clear time"
              >
                <IoClose size={16} />
              </button>
            )}
          </div>
        </FormGroup>
      </FormRow>

      <label className="backlog-checkbox">
        <input
          type="checkbox"
          checked={isBacklogTask}
          onChange={e => {
            setIsBacklogTask(e.target.checked);
            if (e.target.checked) {
              setTaskDate('');
              // Keep 'none' or 'custom' on backlog; collapse other recurrences.
              if (recurrence !== 'none' && recurrence !== 'custom') {
                setRecurrence('none');
              }
            } else {
              setTaskDate(formatDateInput(selectedDate));
              setBacklogMonthSelection('');
            }
          }}
        />
        <span>Add to backlog</span>
        {isBacklogTask && (
          <select
            className="backlog-month-select"
            value={backlogMonthSelection}
            onChange={e => setBacklogMonthSelection(e.target.value)}
          >
            <option value="">Select month...</option>
            {backlogMonths.map(group => (
              <option key={group.monthKey} value={group.monthKey}>
                {group.month}
              </option>
            ))}
          </select>
        )}
      </label>

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
          <OptionPills
            options={isBacklogTask
              ? RECURRENCE_OPTIONS.filter(o => o.key === 'none' || o.key === 'custom')
              : RECURRENCE_OPTIONS}
            value={recurrence}
            onChange={(val) => {
              setRecurrence(val);
              if (val === 'custom' && recurrenceDays.length === 0) {
                const d = taskDate ? new Date(taskDate + 'T00:00:00') : new Date();
                setRecurrenceDays([d.getDay()]);
              }
            }}
          />
          {recurrence === 'custom' && (
            <div className="custom-days-picker">
              {DAY_LABELS.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  className={`day-chip ${recurrenceDays.includes(index) ? 'active' : ''}`}
                  onClick={() => {
                    setRecurrenceDays(prev => {
                      if (prev.includes(index)) {
                        if (prev.length === 1) return prev;
                        return prev.filter(d => d !== index);
                      }
                      return [...prev, index].sort();
                    });
                  }}
                  title={DAY_NAMES[index]}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
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
  );
}
