import { IoCheckmarkCircle, IoEllipseOutline, IoReorderTwo } from '../../utils/icons';
import { ShoppingItem } from '../../types';
import { SortableSwipeItem } from '../../components';
import { colors } from '../../utils/theme';

interface SortableShoppingItemProps {
  item: ShoppingItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableShoppingItem({ item, onToggle, onEdit, onDelete }: SortableShoppingItemProps) {
  const isSharedItem = item.isOwn === false;

  return (
    <SortableSwipeItem
      id={item.id}
      onSwipeDelete={onDelete}
      wrapperClassName={(isDragging) =>
        `item-card ${item.completed ? 'completed' : ''} ${isSharedItem ? 'shared' : ''} ${isDragging ? 'dragging' : ''}`
      }
      contentClassName="item-card-content"
    >
      {({ dragHandleProps }) => (
        <>
          <button className="drag-handle" {...dragHandleProps}>
            <IoReorderTwo size={20} color={colors.textMuted} />
          </button>
          <button className="item-checkbox" onClick={onToggle}>
            {item.completed ? (
              <IoCheckmarkCircle size={22} color={colors.success} />
            ) : (
              <IoEllipseOutline size={22} color={colors.textMuted} />
            )}
          </button>
          <div className="item-content" onClick={onEdit}>
            <div className="item-name">
              {item.name}
              {isSharedItem && (
                <span className="item-owner">({item.ownerName})</span>
              )}
            </div>
            <div className="item-meta">
              <span className="item-qty">×{item.quantity}</span>
            </div>
          </div>
        </>
      )}
    </SortableSwipeItem>
  );
}
