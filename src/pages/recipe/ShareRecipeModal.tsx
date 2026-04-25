import {
  IoCheckmarkCircle, IoRefreshOutline, IoPersonOutline, IoSendOutline,
} from '../../utils/icons';
import { Recipe } from '../../types';
import { Modal } from '../../components';
import { UserConnection } from '../../utils/api';

interface ShareRecipeModalProps {
  isOpen: boolean;
  recipe: Recipe | null;
  email: string;
  isSharing: boolean;
  result: { type: 'success' | 'error'; message: string } | null;
  connections: UserConnection[];
  onClose: () => void;
  onEmailChange: (val: string) => void;
  onShare: (email: string) => void;
}

export function ShareRecipeModal({
  isOpen, recipe, email, isSharing, result, connections,
  onClose, onEmailChange, onShare,
}: ShareRecipeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Recipe">
      <div className="share-recipe-modal">
        <p className="share-recipe-name">
          Sharing: <strong>{recipe?.title}</strong>
        </p>
        <p className="share-recipe-note">
          A copy of this recipe will be added to the other user's recipes.
        </p>

        <div className="share-email-row">
          <input
            type="email"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder="Enter email address..."
            onKeyDown={e => e.key === 'Enter' && onShare(email)}
            disabled={isSharing}
          />
          <button
            className="share-send-btn"
            onClick={() => onShare(email)}
            disabled={!email.trim() || isSharing}
          >
            {isSharing
              ? <IoRefreshOutline size={17} className="spin" />
              : <IoSendOutline size={17} />
            }
          </button>
        </div>

        {result && (
          <p className={`share-result ${result.type}`}>
            {result.type === 'success' && <IoCheckmarkCircle size={14} />}
            {result.message}
          </p>
        )}

        {connections.length > 0 && (
          <div className="share-connections">
            <p className="share-connections-label">Quick share with connections</p>
            <div className="share-connections-list">
              {connections.map(conn => (
                <button
                  key={conn.id}
                  className="share-connection-item"
                  onClick={() => onShare(conn.email)}
                  disabled={isSharing}
                >
                  <div className="share-conn-avatar">
                    <IoPersonOutline size={16} />
                  </div>
                  <div className="share-conn-info">
                    <span className="share-conn-name">{conn.name}</span>
                    <span className="share-conn-email">{conn.email}</span>
                  </div>
                  <IoSendOutline size={14} className="share-conn-send" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
