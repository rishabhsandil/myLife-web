import { IoClose, IoPersonAdd } from '../../utils/icons';
import { ShoppingShareStatus } from '../../types';
import { Modal } from '../../components';

interface ShareShoppingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareStatus: ShoppingShareStatus;
  shareEmail: string;
  shareError: string;
  onShareEmailChange: (value: string) => void;
  onShare: () => void;
  onUnshare: (userId: string) => void;
}

export function ShareShoppingModal({
  isOpen, onClose, shareStatus, shareEmail, shareError,
  onShareEmailChange, onShare, onUnshare,
}: ShareShoppingModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Shopping Connections"
      footer={<button className="btn secondary" onClick={onClose}>Done</button>}
    >
      <p className="share-info">
        Connect with another user to share shopping lists. Connected users can also be assigned to reminders.
      </p>

      <div className="share-add">
        <input
          type="email"
          value={shareEmail}
          onChange={e => onShareEmailChange(e.target.value)}
          placeholder="Enter email address"
          onKeyDown={e => e.key === 'Enter' && onShare()}
        />
        <button className="share-add-btn" onClick={onShare} disabled={!shareEmail.trim()}>
          <IoPersonAdd size={20} />
        </button>
      </div>
      {shareError && <p className="share-error">{shareError}</p>}

      {shareStatus.sharedWith.length > 0 && (
        <div className="share-section">
          <h4>Connected Users</h4>
          <div className="share-list">
            {shareStatus.sharedWith.map(user => (
              <div key={user.id} className="share-item">
                <div className="share-user">
                  <span className="share-name">{user.name}</span>
                  <span className="share-email">{user.email}</span>
                </div>
                <button className="share-remove" onClick={() => onUnshare(user.id)}>
                  <IoClose size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
