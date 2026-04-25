import { useState } from 'react';
import { IoAdd, IoPencil, IoTrash } from 'react-icons/io5';
import { BodyPart, Exercise, WeightUnit } from '../../types';
import { Modal, ColorPicker } from '../../components';

interface WorkoutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bodyParts: BodyPart[];
  exercises: Exercise[];
  weightUnit: WeightUnit;
  onWeightUnitChange: (unit: WeightUnit) => void;
  onSaveBodyPart: (values: { editing: BodyPart | null; name: string; color: string }) => Promise<void> | void;
  onRequestDeleteBodyPart: (bp: BodyPart) => void;
}

export function WorkoutSettingsModal({
  isOpen, onClose, bodyParts, exercises, weightUnit,
  onWeightUnitChange, onSaveBodyPart, onRequestDeleteBodyPart,
}: WorkoutSettingsModalProps) {
  const [editing, setEditing] = useState<BodyPart | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ef4444');

  const reset = () => { setEditing(null); setName(''); setColor('#ef4444'); };
  const startEdit = (bp: BodyPart) => { setEditing(bp); setName(bp.name); setColor(bp.color); };

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSaveBodyPart({ editing, name: name.trim(), color });
    reset();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); reset(); }}
      title="Workout Splits"
      className="settings-modal"
      footer={<button className="btn secondary" onClick={() => { onClose(); reset(); }}>Done</button>}
    >
      <div className="weight-unit-toggle">
        <label className="setting-label">Weight Unit</label>
        <div className="unit-buttons">
          <button className={`unit-btn ${weightUnit === 'kg' ? 'active' : ''}`} onClick={() => onWeightUnitChange('kg')}>kg</button>
          <button className={`unit-btn ${weightUnit === 'lbs' ? 'active' : ''}`} onClick={() => onWeightUnitChange('lbs')}>lbs</button>
        </div>
      </div>
      <div className="body-parts-list">
        {bodyParts.map(bp => (
          <div key={bp.id} className="body-part-item">
            <div className="body-part-color" style={{ background: bp.color }} />
            {editing?.id === bp.id ? (
              <>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="body-part-input" autoFocus />
                <ColorPicker value={color} onChange={setColor} />
                <button className="save-bp-btn" onClick={handleSave}>Save</button>
                <button className="cancel-bp-btn" onClick={reset}></button>
              </>
            ) : (
              <>
                <span className="body-part-name">{bp.name}</span>
                <span className="body-part-exercise-count">{exercises.filter(e => e.bodyPart === bp.id).length} exercises</span>
                <button className="edit-bp-btn" onClick={() => startEdit(bp)}><IoPencil size={16} /></button>
                <button className="delete-bp-btn" onClick={() => onRequestDeleteBodyPart(bp)}><IoTrash size={16} /></button>
              </>
            )}
          </div>
        ))}
      </div>
      {!editing && (
        <div className="add-body-part">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="New split name (e.g., Push)" className="body-part-input" />
          <ColorPicker value={color} onChange={setColor} />
          <button className="btn primary add-bp-btn" onClick={handleSave} disabled={!name.trim()}>
            <IoAdd size={18} /> Add Split
          </button>
        </div>
      )}
    </Modal>
  );
}
