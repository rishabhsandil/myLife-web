import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  IoAdd, IoCheckmarkCircle, IoEllipseOutline, IoTrash,
  IoCart, IoRemove, IoShareSocial, IoPersonAdd, IoClose, 
  IoTime, IoPencil, IoSettings, IoReorderTwo
} from 'react-icons/io5';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ShoppingItem, ShoppingStore, ShoppingShareStatus, ShoppingAuditEntry } from '../types';
import { 
  getShoppingItems, saveShoppingItem, updateShoppingItem, deleteShoppingItem, clearCompletedItems,
  getShoppingStores, saveShoppingStore, updateShoppingStore, deleteShoppingStore as apiDeleteStore,
  getShoppingShareStatus, unshareShoppingList, getShoppingAudit
} from '../utils/api';
import { Modal, ModalFooter, FormGroup, ColorPicker, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import './ShoppingPage.css';

const COLOR_OPTIONS = [
  '#22C55E', '#6366F1', '#F59E0B', '#EF4444', 
  '#14B8A6', '#EC4899', '#8B5CF6', '#64748B'
];

// Sortable Shopping Item Component
interface SortableShoppingItemProps {
  item: ShoppingItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableShoppingItem({ item, onToggle, onEdit, onDelete }: SortableShoppingItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSharedItem = item.isOwn === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item-card ${item.completed ? 'completed' : ''} ${isSharedItem ? 'shared' : ''}`}
    >
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
      >
        <IoReorderTwo size={20} color={colors.textMuted} />
      </button>
      <button className="item-checkbox" onClick={onToggle}>
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
        </div>
      </div>
      <div className="item-actions">
        <button className="icon-btn" onClick={onEdit}>
          <IoPencil size={16} />
        </button>
        <button className="icon-btn delete" onClick={onDelete}>
          <IoTrash size={16} />
        </button>
      </div>
    </div>
  );
}

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [stores, setStores] = useState<ShoppingStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [shareStatus, setShareStatus] = useState<ShoppingShareStatus>({ sharedWith: [], sharedBy: [] });
  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState('');
  const [auditHistory, setAuditHistory] = useState<ShoppingAuditEntry[]>([]);
  
  const modal = useModal();
  const shareModal = useModal();
  const historyModal = useModal();
  const settingsModal = useModal();

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

  // Store form state
  const [editingStore, setEditingStore] = useState<ShoppingStore | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeColor, setStoreColor] = useState(COLOR_OPTIONS[0]);

  // Track mutations to pause sync
  const isMutating = useRef(false);
  const lastSyncTime = useRef(0);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isSharing = shareStatus.sharedWith.length > 0 || shareStatus.sharedBy.length > 0;

  const loadData = useCallback(async (showLoading = true) => {
    // Skip sync if a mutation is in progress
    if (isMutating.current) return;
    
    if (showLoading) setIsLoading(true);
    const [itemsData, storesData] = await Promise.all([
      getShoppingItems(),
      getShoppingStores()
    ]);
    // Double-check mutation didn't start during fetch
    if (!isMutating.current) {
      setItems(itemsData);
      setStores(storesData);
      if (storesData.length > 0 && !selectedStore) {
        setSelectedStore(storesData[0].id);
      }
      lastSyncTime.current = Date.now();
    }
    if (showLoading) setIsLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    loadData();
    loadShareStatus();
  }, [loadData]);

  // Auto-sync when list is shared
  useEffect(() => {
    if (!isSharing) return;
    
    const interval = setInterval(() => {
      loadData(false); // Don't show loading skeleton during background sync
    }, 5000); // Sync every 5 seconds
    
    return () => clearInterval(interval);
  }, [isSharing, loadData]);

  async function loadShareStatus() {
    const status = await getShoppingShareStatus();
    setShareStatus(status);
  }

  const currentStore = stores.find(s => s.id === selectedStore);
  const filteredItems = useMemo(() => {
    // Filter by store name to handle shared lists where users have different store IDs for the same store name
    const storeName = currentStore?.name;
    return items
      .filter(item => item.storeName === storeName)
      .sort((a, b) => {
        // Completed items go to bottom
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        
        // Sort by sortOrder if available
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        
        // Default to creation order
        return 0;
      });
  }, [items, selectedStore, currentStore]);

  const completedCount = filteredItems.filter(i => i.completed).length;
  const totalCount = filteredItems.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const resetForm = () => {
    setName('');
    setQuantity(1);
    setEditingItem(null);
  };

  const openModal = () => {
    resetForm();
    modal.open();
  };

  const openEditModal = (item: ShoppingItem) => {
    setEditingItem(item);
    setName(item.name);
    setQuantity(item.quantity);
    modal.open();
  };

  const openShareModal = () => {
    setShareEmail('');
    setShareError('');
    shareModal.open();
  };

  const openHistoryModal = async () => {
    const history = await getShoppingAudit();
    setAuditHistory(history);
    historyModal.open();
  };

  const handleSave = async () => {
    if (!name.trim() || !selectedStore) return;

    isMutating.current = true;
    try {
      if (editingItem) {
        // Update existing item
        const updatedItem: ShoppingItem = {
          ...editingItem,
          name: name.trim(),
          quantity,
        };
        await updateShoppingItem(updatedItem);
      } else {
        // Create new item
        const newItem: ShoppingItem = {
          id: Date.now().toString(),
          name: name.trim(),
          quantity,
          storeId: selectedStore,
          completed: false,
          createdAt: new Date().toISOString(),
          isOwn: true,
        };
        await saveShoppingItem(newItem);
      }
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
    if (!currentStore) return;
    const storeName = currentStore.name;
    // Optimistic update - filter by store name
    setItems(items.filter(i => !i.completed || i.storeName !== storeName));
    
    isMutating.current = true;
    try {
      await clearCompletedItems(storeName);
    } finally {
      isMutating.current = false;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredItems.findIndex((item) => item.id === active.id);
      const newIndex = filteredItems.findIndex((item) => item.id === over.id);

      const reorderedItems = arrayMove(filteredItems, oldIndex, newIndex);
      
      // Assign sortOrder to all items in this store
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));

      // Optimistically update UI
      setItems(items.map(i => {
        const updatedItem = updatedItems.find(ui => ui.id === i.id);
        return updatedItem || i;
      }));

      // Update all reordered items in backend
      isMutating.current = true;
      try {
        for (const item of updatedItems) {
          await updateShoppingItem(item);
        }
      } finally {
        isMutating.current = false;
      }
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

  // Store management
  const openEditStore = (store: ShoppingStore) => {
    setEditingStore(store);
    setStoreName(store.name);
    setStoreColor(store.color);
  };

  const resetStoreForm = () => {
    setEditingStore(null);
    setStoreName('');
    setStoreColor(COLOR_OPTIONS[0]);
  };

  const handleSaveStore = async () => {
    if (!storeName.trim()) return;

    if (editingStore) {
      const updated: ShoppingStore = { ...editingStore, name: storeName.trim(), color: storeColor };
      await updateShoppingStore(updated);
      setStores(stores.map(s => s.id === updated.id ? updated : s));
    } else {
      const newStore: ShoppingStore = {
        id: `store_${Date.now()}`,
        name: storeName.trim(),
        color: storeColor,
      };
      await saveShoppingStore(newStore);
      setStores([...stores, newStore]);
      if (!selectedStore) {
        setSelectedStore(newStore.id);
      }
    }

    resetStoreForm();
  };

  const handleDeleteStore = async (id: string) => {
    await apiDeleteStore(id);
    setStores(stores.filter(s => s.id !== id));
    setItems(items.filter(i => i.storeId !== id));
    if (selectedStore === id) {
      const remaining = stores.filter(s => s.id !== id);
      setSelectedStore(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get all share partners (people I share with + people who share with me)
  const sharePartners = [...shareStatus.sharedWith, ...shareStatus.sharedBy];

  return (
    <div className="shopping-page">
      {/* Header */}
      <header className="shopping-header" style={{ background: currentStore ? `linear-gradient(135deg, ${currentStore.color} 0%, ${currentStore.color}dd 100%)` : undefined }}>
        <div>
          <h1 className="header-title">{currentStore?.name || 'Shopping'}</h1>
          <p className="header-subtitle">
            {totalCount} items • {completedCount} done
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
          <button className="history-btn" onClick={openHistoryModal} title="View history">
            <IoTime size={20} />
          </button>
          <button className="share-btn" onClick={openShareModal} title="Share list">
            <IoShareSocial size={20} />
          </button>
          {completedCount > 0 && (
            <button className="clear-btn" onClick={clearCompleted}>Clear Done</button>
          )}
        </div>
      </header>

      {/* Store Tabs */}
      <div className="store-tabs">
        {stores.map(store => (
          <button
            key={store.id}
            className={`store-tab ${selectedStore === store.id ? 'active' : ''}`}
            onClick={() => setSelectedStore(store.id)}
            style={{ 
              borderColor: selectedStore === store.id ? store.color : 'transparent',
              color: selectedStore === store.id ? store.color : undefined
            }}
          >
            {store.name}
          </button>
        ))}
        <button className="store-tab settings" onClick={() => settingsModal.open()}>
          <IoSettings size={18} />
        </button>
      </div>

      {/* Progress */}
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${progress}%`,
              background: currentStore?.color || colors.primary 
            }} 
          />
        </div>
        <span className="progress-text">{Math.round(progress)}%</span>
      </div>

      {/* Items List */}
      <div className="items-container">
        {isLoading ? (
          <div className="items-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-item">
                <div className="skeleton-row">
                  <div className="skeleton skeleton-circle"></div>
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text large" style={{ width: '60%' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '30%' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={IoCart}
            message={stores.length === 0 ? "Add a store to get started" : "No items yet"}
            action={stores.length === 0 
              ? { label: 'Add Store', icon: IoAdd, onClick: () => settingsModal.open() }
              : { label: 'Add Item', icon: IoAdd, onClick: openModal }
            }
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredItems.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="items-list">
                {filteredItems.map(item => (
                  <SortableShoppingItem
                    key={item.id}
                    item={item}
                    onToggle={() => toggleComplete(item)}
                    onEdit={() => openEditModal(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* FAB */}
      <FAB onClick={openModal} disabled={stores.length === 0} />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={modal.close}
        title={editingItem ? "Edit Item" : "Add Item"}
        footer={
          <ModalFooter
            onCancel={modal.close}
            onSubmit={handleSave}
            submitText={editingItem ? "Save Changes" : "Add Item"}
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

      {/* Settings Modal - Manage Stores */}
      <Modal
        isOpen={settingsModal.isOpen}
        onClose={() => { settingsModal.close(); resetStoreForm(); }}
        title="Manage Stores"
      >
        <div className="store-settings-list">
          {stores.map(store => (
            <div key={store.id} className="store-settings-item">
              {editingStore?.id === store.id ? (
                <div className="store-edit-form">
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder="Store name"
                    autoFocus
                  />
                  <ColorPicker
                    colors={COLOR_OPTIONS}
                    value={storeColor}
                    onChange={setStoreColor}
                  />
                  <div className="store-edit-actions">
                    <button className="btn secondary" onClick={resetStoreForm}>Cancel</button>
                    <button className="btn primary" onClick={handleSaveStore} disabled={!storeName.trim()}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="store-info">
                    <span className="store-color" style={{ background: store.color }} />
                    <span className="store-name">{store.name}</span>
                  </div>
                  <div className="store-actions">
                    <button className="edit-store-btn" onClick={() => openEditStore(store)}>
                      <IoPencil size={16} />
                    </button>
                    <button className="delete-store-btn" onClick={() => handleDeleteStore(store.id)}>
                      <IoTrash size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new store */}
        {!editingStore && (
          <div className="add-store-form">
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="New store name"
            />
            <ColorPicker
              colors={COLOR_OPTIONS}
              value={storeColor}
              onChange={setStoreColor}
            />
            <button 
              className="btn primary" 
              onClick={handleSaveStore} 
              disabled={!storeName.trim()}
            >
              <IoAdd size={18} /> Add Store
            </button>
          </div>
        )}
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

      {/* History Modal */}
      <Modal isOpen={historyModal.isOpen} onClose={historyModal.close} title="Activity History">
        <div className="history-list">
          {auditHistory.length === 0 ? (
            <p className="history-empty">No activity yet</p>
          ) : (
            auditHistory.map(entry => (
              <div key={entry.id} className="history-item">
                <div className="history-content">
                  <span className={`history-action ${entry.action}`}>
                    {entry.action === 'added' && '➕'}
                    {entry.action === 'completed' && '✅'}
                    {entry.action === 'uncompleted' && '⬜'}
                    {entry.action === 'deleted' && '🗑️'}
                    {entry.action === 'cleared' && '🧹'}
                  </span>
                  <div className="history-details">
                    <span className="history-user">{entry.userName}</span>
                    <span className="history-text">
                      {entry.action} <strong>{entry.itemName}</strong>
                    </span>
                    {entry.details && <span className="history-meta">{entry.details}</span>}
                  </div>
                </div>
                <span className="history-time">
                  {new Date(entry.createdAt).toLocaleDateString(undefined, { 
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
