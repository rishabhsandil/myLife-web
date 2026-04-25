import { useState } from 'react';
import { IoAdd, IoPencil, IoTrash } from '../../utils/icons';
import { Modal, ColorPicker } from '../../components';

interface Category { id: string; name: string; color: string }

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveCategory: (values: { editing: Category | null; name: string; color: string }) => Promise<void> | void;
  onRequestDeleteCategory: (cat: Category) => void;
}

export function CategoryManagementModal({
  isOpen, onClose, categories, onSaveCategory, onRequestDeleteCategory,
}: CategoryManagementModalProps) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366F1');

  const reset = () => { setEditing(null); setName(''); setColor('#6366F1'); };
  const startEdit = (cat: Category) => { setEditing(cat); setName(cat.name); setColor(cat.color); };

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSaveCategory({ editing, name: name.trim(), color });
    reset();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); reset(); }}
      title="Manage Categories"
    >
      <div className="store-settings-list">
        {categories.map(cat => (
          <div key={cat.id} className="store-settings-item">
            {editing?.id === cat.id ? (
              <div className="store-edit-form">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Category name"
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
                  <span className="store-color" style={{ background: cat.color }} />
                  <span className="store-name">{cat.name}</span>
                </div>
                <div className="store-actions">
                  <button className="edit-store-btn" onClick={() => startEdit(cat)}>
                    <IoPencil size={16} />
                  </button>
                  <button className="delete-store-btn" onClick={() => onRequestDeleteCategory(cat)}>
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
            placeholder="New category name"
          />
          <ColorPicker value={color} onChange={setColor} />
          <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
            <IoAdd size={18} /> Add Category
          </button>
        </div>
      )}
    </Modal>
  );
}
