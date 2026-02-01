import { IoAdd } from 'react-icons/io5';
import './FAB.css';

interface FABProps {
  onClick: () => void;
  disabled?: boolean;
}

export function FAB({ onClick, disabled }: FABProps) {
  return (
    <button className="fab" onClick={onClick} disabled={disabled}>
      <IoAdd size={28} />
    </button>
  );
}
