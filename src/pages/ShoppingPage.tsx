import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  IoAdd, IoCheckmarkCircle, IoEllipseOutline, IoTrash,
  IoCart, IoBasket, IoEllipsisHorizontal, IoRemove,
  IoShareSocial, IoPersonAdd, IoClose
} from 'react-icons/io5';
import { ShoppingItem, ShoppingCategory, ShoppingShareStatus } from '../types';
import { 
  getShoppingItems, saveShoppingItem, updateShoppingItem, deleteShoppingItem, clearCompletedItems,
  getShoppingShareStatus, unshareShoppingList
} from '../utils/api';
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
  const [shareStatus, setShareStatus] = useState<ShoppingShareStatus>({ sharedWith: [], sharedBy: [] });
  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState('');
  
  const modal = useModal();
  const shareModal = useModal();

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState<ShoppingCategory>('freshco');

  // Track mutations to pause sync
  const isMutating = useRef(false);
  const lastSyncTime = useRef(0);

  const isSharing = shareStatus.sharedWith.length > 0 || shareStatus.sharedBy.length > 0;

  const loadItems = useCallback(async () => {
    // Skip sync if a mutation is in progress
    if (isMutating.current) return;
    
    const data = await getShoppingItems();
    // Double-check mutation didn't start during fetch
    if (!isMutating.current) {
      setItems(data);
      lastSyncTime.current = Date.now();
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadShareStatus();
  }, [loadItems]);

  // Auto-sync when list is shared
  useEffect(() => {
    if (!isSharing) return;
    
    const interval = setInterval(() => {
      loadItems();
    }, 5000); // Sync every 5 seconds
    
    return () => clearInterval(interval);
  }, [isSharing, loadItems]);

  async function loadShareStatus() {
    const status = await getShoppingShareStatus();
    setShareStatus(status);
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

  const openShareModal = () => {
    setShareEmail('');
    setShareError('');
    shareModal.open();
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
      isOwn: true,
    };

    isMutating.current = true;
    try {
      await saveShoppingItem(newItem);
      // Fetch fresh data from server to get authoritative state
      const data = await getShoppingItems();
      setItems(data);
    } finally {
      isMutating.current = false;
    }
    modal.close();
  };

  const toggleComplete = async (item: ShoppingItem) => {
    const updatedItem = { ...item, completed: !item.completed };
    // Optimistic update
    setItems(items.map(i => i.id === item.id ? updatedItem : i));
    
    isMutating.current = true;
    try {
      await updateShoppingItem(updatedItem);
    } finally {
      isMutating.current = false;
    }
  };

  const deleteItem = async (id: string) => {
    // Optimistic update
    setItems(items.filter(i => i.id !== id));
    
    isMutating.current = true;
    try {
      await deleteShoppingItem(id);
    } finally {
      isMutating.current = false;
    }
  };

  const clearCompleted = async () => {
    // Optimistic update
    setItems(items.filter(i => !i.completed));
    
    isMutating.current = true;
    try {
      await clearCompletedItems();
    } finally {
      isMutating.current = false;
    }
  };

  const handleShare = async () => {
    if (!shareEmail.trim()) return;
    
    setShareError('');
    try {
      const response = await fetch(`/api/shopping-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ email: shareEmail.trim().toLowerCase() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setShareError(data.error || 'Failed to share');
        return;
      }
      
      setShareStatus(prev => ({
        ...prev,
        sharedWith: [...prev.sharedWith, data.sharedWith],
      }));
      setShareEmail('');
    } catch {
      setShareError('Failed to share list');
    }
  };

  const handleUnshare = async (userId: string) => {
    await unshareShoppingList(userId);
    setShareStatus(prev => ({
      ...prev,
      sharedWith: prev.sharedWith.filter(u => u.id !== userId),
    }));
  };

  const getCategoryIcon = (cat: ShoppingCategory) => {
    return CATEGORIES.find(c => c.key === cat)?.icon || IoCart;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get all share partners (people I share with + people who share with me)
  const sharePartners = [...shareStatus.sharedWith, ...shareStatus.sharedBy];

  return (
    <div className="shopping-page">
      {/* Header */}
      <header className="shopping-header">
        <div>
          <h1 className="header-title">Shopping List</h1>
          <p className="header-subtitle">
            {items.length} items • {completedCount} done
            {isSharing && ' • Shared'}
          </p>
        </div>
        <div className="header-actions">
          {sharePartners.length > 0 && (
            <div className="share-partners">
              {sharePartners.slice(0, 2).map(partner => (
                <span 
                  key={partner.id} 
                  className="partner-badge" 
                  title={`Shared with ${partner.name}`}
                >
                  {getInitials(partner.name)}
                </span>
              ))}
              {sharePartners.length > 2 && (
                <span className="partner-badge more">+{sharePartners.length - 2}</span>
              )}
            </div>
          )}
          <button className="share-btn" onClick={openShareModal} title="Share list">
            <IoShareSocial size={20} />
          </button>
          {completedCount > 0 && (
            <button className="clear-btn" onClick={clearCompleted}>Clear Done</button>
          )}
        </div>
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
              const isSharedItem = item.isOwn === false;
              return (
                <div key={item.id} className={`item-card ${item.completed ? 'completed' : ''} ${isSharedItem ? 'shared' : ''}`}>
                  <button className="item-checkbox" onClick={() => toggleComplete(item)}>
                    {item.completed ? (
                      <IoCheckmarkCircle size={24} color={colors.success} />
                    ) : (
                      <IoEllipseOutline size={24} color={colors.textMuted} />
                    )}
                  </button>
                  <div className="item-content">
                    <div className="item-name">
                      {item.name}
                      {isSharedItem && (
                        <span className="item-owner">({item.ownerName})</span>
                      )}
                    </div>
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

      {/* Share Modal */}
      <Modal
        isOpen={shareModal.isOpen}
        onClose={shareModal.close}
        title="Share Shopping List"
        footer={<button className="btn secondary" onClick={shareModal.close}>Done</button>}
      >
        <p className="share-info">
          Share your shopping list with another user. They'll see your items and can mark them as done.
        </p>

        {/* Add new share */}
        <div className="share-add">
          <input
            type="email"
            value={shareEmail}
            onChange={e => setShareEmail(e.target.value)}
            placeholder="Enter email address"
            onKeyDown={e => e.key === 'Enter' && handleShare()}
          />
          <button className="share-add-btn" onClick={handleShare} disabled={!shareEmail.trim()}>
            <IoPersonAdd size={20} />
          </button>
        </div>
        {shareError && <p className="share-error">{shareError}</p>}

        {/* People I share with */}
        {shareStatus.sharedWith.length > 0 && (
          <div className="share-section">
            <h4>Shared with</h4>
            <div className="share-list">
              {shareStatus.sharedWith.map(user => (
                <div key={user.id} className="share-item">
                  <div className="share-user">
                    <span className="share-name">{user.name}</span>
                    <span className="share-email">{user.email}</span>
                  </div>
                  <button className="share-remove" onClick={() => handleUnshare(user.id)}>
                    <IoClose size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* People who share with me */}
        {shareStatus.sharedBy.length > 0 && (
          <div className="share-section">
            <h4>Shared by others</h4>
            <div className="share-list">
              {shareStatus.sharedBy.map(user => (
                <div key={user.id} className="share-item">
                  <div className="share-user">
                    <span className="share-name">{user.name}</span>
                    <span className="share-email">{user.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
