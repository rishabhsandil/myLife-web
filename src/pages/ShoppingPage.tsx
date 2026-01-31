import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoCheckmarkCircle, IoEllipseOutline, IoTrash,
  IoCart, IoBasket, IoEllipsisHorizontal, IoRemove
} from 'react-icons/io5';
import { ShoppingItem, ShoppingCategory } from '../types';
import { getShoppingItems, saveShoppingItem, updateShoppingItem, deleteShoppingItem, clearCompletedItems } from '../utils/api.ts';
import { Modal, ModalFooter, FormGroup, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import './ShoppingPage.css';

const CATEGORIES: { key: ShoppingCategory; label: string; icon: typeof IoCart }[] = [
  { key: 'freshco', label: 'FreshCo', icon: IoCart },
  { key: 'costco', label: 'Costco', icon: IoBasket },
  { key: 'amazon', label: 'Amazon', icon: IoCart },
  { key: 'other', label: 'Other', icon: IoEllipsisHorizontal },
];

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [filter, setFilter] = useState<ShoppingCategory | 'all'>('all');
  const modal = useModal();

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState<ShoppingCategory>('freshco');

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

  const resetForm = () => {
    setName('');
    setQuantity(1);
    setCategory('freshco');
  };

  const openModal = () => {
    resetForm();
    modal.open();
  };

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
    modal.close();
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
    return CATEGORIES.find(c => c.key === cat)?.icon || IoCart;
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
          <button className="clear-btn" onClick={clearCompleted}>Clear Done</button>
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
          <EmptyState
            icon={IoCart}
            message="No items yet"
            action={{ label: 'Add Item', icon: IoAdd, onClick: openModal }}
          />
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
      <FAB onClick={openModal} />

      {/* Add Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={modal.close}
        title="Add Item"
        footer={
          <ModalFooter
            onCancel={modal.close}
            onSubmit={handleSave}
            submitText="Add Item"
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

        <FormGroup label="Category">
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
        </FormGroup>
      </Modal>
    </div>
  );
}
