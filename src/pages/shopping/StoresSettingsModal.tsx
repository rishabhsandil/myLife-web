import { useState } from 'react';
import { IoAdd, IoPencil, IoTrash } from '../../utils/icons';
import { ShoppingStore } from '../../types';
import { Modal, ColorPicker } from '../../components';

interface StoresSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: ShoppingStore[];
  onSaveStore: (values: { editing: ShoppingStore | null; name: string; color: string }) => Promise<void> | void;
  onRequestDeleteStore: (store: ShoppingStore) => void;
}

export function StoresSettingsModal({
  isOpen, onClose, stores, onSaveStore, onRequestDeleteStore,
}: StoresSettingsModalProps) {
  const [editing, setEditing] = useState<ShoppingStore | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#22c55e');

  const reset = () => { setEditing(null); setName(''); setColor('#22c55e'); };
  const startEdit = (store: ShoppingStore) => { setEditing(store); setName(store.name); setColor(store.color); };

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSaveStore({ editing, name: name.trim(), color });
    reset();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); reset(); }}
      title="Manage Stores"
    >
      <div className="store-settings-list">
        {stores.map(store => (
          <div key={store.id} className="store-settings-item">
            {editing?.id === store.id ? (
              <div className="store-edit-form">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Store name"
                  autoFocus
                />
                <ColorPicker value={color} onChange={setColor} />
                <div className="store-edit-actions">
                  <button className="btn secondary" onClick={reset}>Cancel</button>
                  <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <div className="store-info">
                  <span className="store-color" style={{ background: store.color }} />
                  <span className="store-name">{store.name}</span>
                </div>
                <div className="store-actions">
                  <button className="edit-store-btn" onClick={() => startEdit(store)}>
                    <IoPencil size={16} />
                  </button>
                  <button className="delete-store-btn" onClick={() => onRequestDeleteStore(store)}>
                    <IoTrash size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {!editing && (
        <div className="add-store-form">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="New store name"
          />
          <ColorPicker value={color} onChange={setColor} />
          <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
            <IoAdd size={18} /> Add Store
          </button>
        </div>
      )}
    </Modal>
  );
}
