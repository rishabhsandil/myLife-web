import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoClose, IoCheckmarkCircle, IoEllipseOutline, IoTrash,
  IoCart, IoBasket, IoPerson, IoEllipsisHorizontal, IoRemove
} from 'react-icons/io5';
import { ShoppingItem, ShoppingCategory } from '../types';
import { getShoppingItems, saveShoppingItem, updateShoppingItem, deleteShoppingItem, clearCompletedItems } from '../utils/api';
import { colors } from '../utils/theme';
import './ShoppingPage.css';

const CATEGORIES: { key: ShoppingCategory; label: string; icon: typeof IoCart }[] = [
  { key: 'groceries', label: 'Groceries', icon: IoCart },
  { key: 'household', label: 'Household', icon: IoBasket },
  { key: 'personal', label: 'Personal', icon: IoPerson },
  { key: 'other', label: 'Other', icon: IoEllipsisHorizontal },
];

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<ShoppingCategory | 'all'>('all');

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState<ShoppingCategory>('groceries');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const data = await getShoppingItems();
    setItems(data);
  }

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(item => item.category === filter);
  }, [items, filter]);

  const completedCount = items.filter(i => i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleSave = async () => {
    if (!name.trim()) return;

    const newItem: ShoppingItem = {
      id: Date.now().toString(),
      name: name.trim(),
      quantity,
      category,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    await saveShoppingItem(newItem);
    setItems([...items, newItem]);
    resetForm();
    setShowAddModal(false);
  };

  const resetForm = () => {
    setName('');
    setQuantity(1);
    setCategory('groceries');
  };

  const toggleComplete = async (item: ShoppingItem) => {
    const updatedItem = { ...item, completed: !item.completed };
    await updateShoppingItem(updatedItem);
    setItems(items.map(i => i.id === item.id ? updatedItem : i));
  };

  const deleteItem = async (id: string) => {
    await deleteShoppingItem(id);
    setItems(items.filter(i => i.id !== id));
  };

  const clearCompleted = async () => {
    await clearCompletedItems();
    setItems(items.filter(i => !i.completed));
  };

  const getCategoryIcon = (cat: ShoppingCategory) => {
    const found = CATEGORIES.find(c => c.key === cat);
    return found?.icon || IoCart;
  };

  return (
    <div className="shopping-page">
      {/* Header */}
      <header className="shopping-header">
        <div>
          <h1 className="header-title">Shopping List</h1>
          <p className="header-subtitle">{items.length} items • {completedCount} done</p>
        </div>
        {completedCount > 0 && (
          <button className="clear-btn" onClick={clearCompleted}>
            Clear Done
          </button>
        )}
      </header>

      {/* Progress */}
      <div className="progress-container">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-text">{Math.round(progress)}%</span>
      </div>

      {/* Filter */}
      <div className="filter-container">
        <button
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`filter-chip ${filter === cat.key ? 'active' : ''}`}
            onClick={() => setFilter(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="items-container">
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <IoCart size={48} color={colors.textMuted} />
            <p>No items yet</p>
            <button className="add-item-btn" onClick={() => setShowAddModal(true)}>
              <IoAdd size={20} /> Add Item
            </button>
          </div>
        ) : (
          <div className="items-list">
            {filteredItems.map(item => {
              const Icon = getCategoryIcon(item.category);
              return (
                <div key={item.id} className={`item-card ${item.completed ? 'completed' : ''}`}>
                  <button className="item-checkbox" onClick={() => toggleComplete(item)}>
                    {item.completed ? (
                      <IoCheckmarkCircle size={24} color={colors.success} />
                    ) : (
                      <IoEllipseOutline size={24} color={colors.textMuted} />
                    )}
                  </button>
                  <div className="item-content">
                    <div className="item-name">{item.name}</div>
                    <div className="item-meta">
                      <span className="item-qty">×{item.quantity}</span>
                      <span className={`item-category ${item.category}`}>
                        <Icon size={12} /> {item.category}
                      </span>
                    </div>
                  </div>
                  <button className="item-delete" onClick={() => deleteItem(item.id)}>
                    <IoTrash size={18} color={colors.error} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => { resetForm(); setShowAddModal(true); }}>
        <IoAdd size={28} />
      </button>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Item</h2>
              <button onClick={() => setShowAddModal(false)}>
                <IoClose size={24} color={colors.textSecondary} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Item Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="What do you need?"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Quantity</label>
                <div className="quantity-control">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                    <IoRemove size={20} />
                  </button>
                  <span>{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)}>
                    <IoAdd size={20} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Category</label>
                <div className="category-grid">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.key}
                        className={`category-btn ${category === cat.key ? 'active' : ''}`}
                        onClick={() => setCategory(cat.key)}
                      >
                        <Icon size={24} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
