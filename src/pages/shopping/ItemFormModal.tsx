import { useState, useEffect } from 'react';
import { IoAdd, IoRemove } from '../../utils/icons';
import { ShoppingItem } from '../../types';
import { Modal, ModalFooter, FormGroup } from '../../components';

interface ItemFormModalProps {
  isOpen: boolean;
  editingItem: ShoppingItem | null;
  onClose: () => void;
  onSubmit: (values: { name: string; quantity: number }) => void;
}

export function ItemFormModal({ isOpen, editingItem, onClose, onSubmit }: ItemFormModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      setName(editingItem.name);
      setQuantity(editingItem.quantity);
    } else {
      setName('');
      setQuantity(1);
    }
  }, [isOpen, editingItem]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), quantity });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? 'Edit Item' : 'Add Item'}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitText={editingItem ? 'Save Changes' : 'Add Item'}
          submitDisabled={!name.trim()}
        />
      }
    >
      <FormGroup label="Item Name">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="What do you need?"
          autoFocus
        />
      </FormGroup>
      <FormGroup label="Quantity">
        <div className="quantity-control">
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
            <IoRemove size={20} />
          </button>
          <span>{quantity}</span>
          <button onClick={() => setQuantity(quantity + 1)}>
            <IoAdd size={20} />
          </button>
        </div>
      </FormGroup>
    </Modal>
  );
}
