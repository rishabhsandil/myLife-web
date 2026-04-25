import { IoClose, IoTrash } from '../../utils/icons';
import { TodoItem } from '../../types';
import { Modal } from '../../components';
import { colors } from '../../utils/theme';
import { formatDate } from './todoHelpers';

interface DeleteTaskModalProps {
  isOpen: boolean;
  task: TodoItem | null;
  selectedDate: Date;
  onClose: () => void;
  onDelete: (task: TodoItem, deleteAll: boolean) => void;
}

export function DeleteTaskModal({
  isOpen, task, selectedDate, onClose, onDelete,
}: DeleteTaskModalProps) {
  const isRecurring = task?.recurrence !== 'none';
  const dangerStyle = { border: `1px solid ${colors.error}`, backgroundColor: 'transparent' };
  const cancelStyle = { border: `1px solid ${colors.border}`, backgroundColor: 'transparent' };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRecurring ? 'Delete Recurring Task' : 'Delete Task'}
    >
      {isRecurring ? (
        <>
          <p style={{ marginBottom: '1.5rem', color: colors.textSecondary }}>
            This is a recurring task. How would you like to delete it?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="backup-btn"
              style={dangerStyle}
              onClick={() => { if (task) { onDelete(task, false); onClose(); } }}
            >
              <IoTrash size={24} color={colors.error} />
              <div>
                <span className="backup-btn-title" style={{ color: colors.error }}>Delete This Day Only</span>
                <span className="backup-btn-sub">Remove from {formatDate(selectedDate)}</span>
              </div>
            </button>
            <button
              className="backup-btn"
              style={dangerStyle}
              onClick={() => { if (task) { onDelete(task, true); onClose(); } }}
            >
              <IoTrash size={24} color={colors.error} />
              <div>
                <span className="backup-btn-title" style={{ color: colors.error }}>Delete Entire Series</span>
                <span className="backup-btn-sub">Remove all occurrences permanently</span>
              </div>
            </button>
            <button className="backup-btn" style={cancelStyle} onClick={onClose}>
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
            Are you sure you want to delete "{task?.title}"?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="backup-btn"
              style={dangerStyle}
              onClick={() => { if (task) { onDelete(task, true); onClose(); } }}
            >
              <IoTrash size={24} color={colors.error} />
              <div>
                <span className="backup-btn-title" style={{ color: colors.error }}>Delete Task</span>
                <span className="backup-btn-sub">This action cannot be undone</span>
              </div>
            </button>
            <button className="backup-btn" style={cancelStyle} onClick={onClose}>
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
  );
}
