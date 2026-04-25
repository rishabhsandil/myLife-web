import { ShoppingAuditEntry } from '../../types';
import { Modal } from '../../components';

interface ShoppingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: ShoppingAuditEntry[];
}

export function ShoppingHistoryModal({ isOpen, onClose, history }: ShoppingHistoryModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activity History">
      <div className="history-list">
        {history.length === 0 ? (
          <p className="history-empty">No activity yet</p>
        ) : (
          history.map(entry => (
            <div key={entry.id} className="history-item">
              <div className="history-content">
                <span className={`history-action ${entry.action}`}>
                  {entry.action === 'added' && '➕'}
                  {entry.action === 'completed' && '✅'}
                  {entry.action === 'uncompleted' && '⬜'}
                  {entry.action === 'deleted' && '🗑️'}
                  {entry.action === 'cleared' && '🧹'}
                </span>
                <div className="history-details">
                  <span className="history-user">{entry.userName}</span>
                  <span className="history-text">
                    {entry.action} <strong>{entry.itemName}</strong>
                  </span>
                  {entry.details && <span className="history-meta">{entry.details}</span>}
                </div>
              </div>
              <span className="history-time">
                {new Date(entry.createdAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
