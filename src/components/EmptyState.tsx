import { ComponentType } from 'react';
import { colors } from '../utils/theme';
import './EmptyState.css';

interface EmptyStateProps {
  icon: ComponentType<{ size: number; color: string }>;
  message: string;
  action?: {
    label: string;
    icon?: ComponentType<{ size: number }>;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon size={48} color={colors.textMuted} />
      <p>{message}</p>
      {action && (
        <button className="empty-state-btn" onClick={action.onClick}>
          {action.icon && <action.icon size={20} />}
          {action.label}
        </button>
      )}
    </div>
  );
}
