import { ReactNode } from 'react';
import { IoClose } from 'react-icons/io5';
import { colors } from '../utils/theme';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, className = '' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${className}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <IoClose size={24} color={colors.textSecondary} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModalFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  cancelText?: string;
  submitText?: string;
  submitDisabled?: boolean;
}

export function ModalFooter({ 
  onCancel, 
  onSubmit, 
  cancelText = 'Cancel', 
  submitText = 'Save',
  submitDisabled = false 
}: ModalFooterProps) {
  return (
    <>
      <button className="btn secondary" onClick={onCancel}>{cancelText}</button>
      <button className="btn primary" onClick={onSubmit} disabled={submitDisabled}>
        {submitText}
      </button>
    </>
  );
}
