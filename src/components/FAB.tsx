import { IoAdd } from 'react-icons/io5';
import './FAB.css';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <button className="fab" onClick={onClick}>
      <IoAdd size={28} />
    </button>
  );
}
