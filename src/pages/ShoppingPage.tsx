import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  IoAdd, IoCheckmarkCircle, IoEllipseOutline, IoTrash,
  IoCart, IoRemove, IoShareSocial, IoPersonAdd, IoClose, 
  IoTime, IoPencil, IoSettings, IoReorderTwo, IoSearchOutline
} from '../utils/icons';
import { useSwipeable } from 'react-swipeable';
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
  getShoppingShareStatus, shareShoppingList, unshareShoppingList, getShoppingAudit
} from '../utils/api';
import { Modal, ModalFooter, FormGroup, ColorPicker, FAB, EmptyState } from '../components';
import { useToast } from '../components/Toast';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import './ShoppingPage.css';

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
    isDragging,
  } = useSortable({ id: item.id });

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const resetSwipe = () => {
    setSwipeOffset(0);
    setIsSwiping(false);
  };

  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left') {
        const offset = Math.min(0, Math.max(-100, eventData.deltaX));
        setSwipeOffset(offset);
        setIsSwiping(true);
      }
    },
    onSwiped: (eventData) => {
      if (eventData.dir === 'Left' && swipeOffset < -70) {
        // Call delete and reset immediately - modal will handle confirmation
        onDelete();
        // Reset after a short delay to allow modal to open
        setTimeout(resetSwipe, 300);
      } else {
        resetSwipe();
      }
      setIsSwiping(false);
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSwiping ? 'none' : transition,
  };

  const contentStyle = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const isSharedItem = item.isOwn === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item-card ${item.completed ? 'completed' : ''} ${isSharedItem ? 'shared' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div className="item-card-content" style={contentStyle} {...swipeHandlers}>
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
        >
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
      </div>
    </div>
  );
}

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [stores, setStores] = useState<ShoppingStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [itemSearch, setItemSearch] = useState('');
  const [shareStatus, setShareStatus] = useState<ShoppingShareStatus>({ sharedWith: [], sharedBy: [] });
  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState('');
  const [auditHistory, setAuditHistory] = useState<ShoppingAuditEntry[]>([]);
  
  const modal = useModal();
  const shareModal = useModal();
  const historyModal = useModal();
  const settingsModal = useModal();
  const deleteModal = useModal<ShoppingItem>();
  const deleteStoreModal = useModal<ShoppingStore>();

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

  // Store form state
  const [editingStore, setEditingStore] = useState<ShoppingStore | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeColor, setStoreColor] = useState('#22c55e');

  const { showError } = useToast();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isSharing = shareStatus.sharedWith.length > 0 || shareStatus.sharedBy.length > 0;

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    const [itemsData, storesData] = await Promise.all([
      getShoppingItems(),
      getShoppingStores()
    ]);
    setItems(itemsData);
    setStores(storesData);
    if (storesData.length > 0 && !selectedStore) {
      setSelectedStore(storesData[0].id);
    }
    if (showLoading) setIsLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    loadData();
    loadShareStatus();
  }, [loadData]);

  // Auto-sync when list is shared — only while tab is visible, and refresh on re-focus
  useEffect(() => {
    if (!isSharing) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        loadData(false);
      }, 60000); // Poll every 60s while visible
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData(false); // Refresh immediately on tab re-focus
        startPolling();
      } else {
        stopPolling(); // Stop polling when hidden so Neon can auto-suspend
      }
    };

    // Start polling only if tab is currently visible
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isSharing, loadData]);

  async function loadShareStatus() {
    const status = await getShoppingShareStatus();
    setShareStatus(status);
  }

  const currentStore = stores.find(s => s.id === selectedStore);
  const filteredItems = useMemo(() => {
    // Filter by store name to handle shared lists where users have different store IDs for the same store name
    const storeName = currentStore?.name;
    let result = items
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
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, selectedStore, currentStore, itemSearch]);

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

    const previousItems = items;
    const trimmedName = name.trim();
    const isEdit = !!editingItem;
    let mutated: ShoppingItem;

    if (editingItem) {
      // Optimistic edit
      mutated = { ...editingItem, name: trimmedName, quantity };
      setItems(items.map(i => i.id === editingItem.id ? mutated : i));
    } else {
      // Optimistic create
      mutated = {
        id: Date.now().toString(),
        name: trimmedName,
        quantity,
        storeId: selectedStore,
        completed: false,
        createdAt: new Date().toISOString(),
        isOwn: true,
      };
      setItems([...items, mutated]);
    }
    modal.close();

    try {
      if (isEdit) {
        await updateShoppingItem(mutated);
      } else {
        await saveShoppingItem(mutated);
      }
    } catch (err) {
      setItems(previousItems);
      showError(err, isEdit ? 'Failed to update item' : 'Failed to add item');
    }
  };

  const toggleComplete = async (item: ShoppingItem) => {
    const updatedItem = { ...item, completed: !item.completed };
    const previousItems = items;
    // Optimistic update
    setItems(items.map(i => i.id === item.id ? updatedItem : i));

    try {
      await updateShoppingItem(updatedItem);
    } catch (err) {
      setItems(previousItems);
      showError(err, 'Failed to update item');
    }
  };

  const deleteItem = async (id: string) => {
    const previousItems = items;
    // Optimistic update
    setItems(items.filter(i => i.id !== id));

    try {
      await deleteShoppingItem(id);
    } catch (err) {
      setItems(previousItems);
      showError(err, 'Failed to delete item');
    }
  };

  const clearCompleted = async () => {
    if (!currentStore) return;
    const storeName = currentStore.name;
    const previousItems = items;
    // Optimistic update - filter by store name
    setItems(items.filter(i => !i.completed || i.storeName !== storeName));

    try {
      await clearCompletedItems(storeName);
    } catch (err) {
      setItems(previousItems);
      showError(err, 'Failed to clear completed items');
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

      const previousItems = items;
      // Optimistically update UI
      setItems(items.map(i => {
        const updatedItem = updatedItems.find(ui => ui.id === i.id);
        return updatedItem || i;
      }));

      // Update all reordered items in backend
      try {
        for (const item of updatedItems) {
          await updateShoppingItem(item);
        }
      } catch (err) {
        setItems(previousItems);
        showError(err, 'Failed to reorder items');
      }
    }
  };

  const handleShare = async () => {
    if (!shareEmail.trim()) return;

    setShareError('');
    const result = await shareShoppingList(shareEmail.trim().toLowerCase());
    if (!result.success || !result.sharedWith) {
      setShareError(result.error || 'Failed to share');
      return;
    }
    const newShare = result.sharedWith;
    setShareStatus(prev => ({
      ...prev,
      sharedWith: [...prev.sharedWith, newShare],
    }));
    setShareEmail('');
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
    setStoreColor('#22c55e');
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
            onClick={() => { setSelectedStore(store.id); setItemSearch(''); }}
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

      {/* Per-store search bar */}
      <div className="shopping-search-bar">
        <IoSearchOutline size={16} className="shopping-search-icon" />
        <input
          className="shopping-search-input"
          type="text"
          placeholder="Search items..."
          value={itemSearch}
          onChange={e => setItemSearch(e.target.value)}
        />
        {itemSearch && (
          <button className="shopping-search-clear" onClick={() => setItemSearch('')}>
            <IoClose size={15} />
          </button>
        )}
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
                    onDelete={() => deleteModal.open(item)}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Item"
        footer={
          <ModalFooter
            onCancel={deleteModal.close}
            onSubmit={() => {
              if (deleteModal.data) {
                deleteItem(deleteModal.data.id);
                deleteModal.close();
              }
            }}
            submitText="Delete"
            cancelText="Cancel"
            submitDestructive
          />
        }
      >
        <p>Are you sure you want to delete "{deleteModal.data?.name}"?</p>
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
                    <button className="delete-store-btn" onClick={() => deleteStoreModal.open(store)}>
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
        title="Shopping Connections"
        footer={<button className="btn secondary" onClick={shareModal.close}>Done</button>}
      >
        <p className="share-info">
          Connect with another user to share shopping lists. Connected users can also be assigned to reminders.
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

        {/* Connected users */}
        {shareStatus.sharedWith.length > 0 && (
          <div className="share-section">
            <h4>Connected Users</h4>
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

      {/* Delete Store Confirmation Modal */}
      <Modal
        isOpen={deleteStoreModal.isOpen}
        onClose={deleteStoreModal.close}
        title="Delete Store"
        footer={
          <ModalFooter
            onCancel={deleteStoreModal.close}
            onSubmit={() => {
              if (deleteStoreModal.data) {
                handleDeleteStore(deleteStoreModal.data.id);
                deleteStoreModal.close();
              }
            }}
            submitText="Delete"
            submitDestructive={true}
          />
        }
      >
        <p>Are you sure you want to delete this store?</p>
        {deleteStoreModal.data && (
          <>
            <p><strong>{deleteStoreModal.data.name}</strong></p>
            <p>This will also delete all {items.filter(i => i.storeId === deleteStoreModal.data!.id).length} item{items.filter(i => i.storeId === deleteStoreModal.data!.id).length !== 1 ? 's' : ''} in this store.</p>
          </>
        )}
      </Modal>
    </div>
  );
}
