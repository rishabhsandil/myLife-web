import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  IoAdd, IoCart, IoShareSocial, IoClose, IoTime, IoSettings, IoSearchOutline,
} from '../utils/icons';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ShoppingItem, ShoppingStore, ShoppingShareStatus, ShoppingAuditEntry } from '../types';
import {
  getShoppingItems, saveShoppingItem, updateShoppingItem, deleteShoppingItem, clearCompletedItems,
  getShoppingStores, saveShoppingStore, updateShoppingStore, deleteShoppingStore as apiDeleteStore,
  getShoppingShareStatus, shareShoppingList, unshareShoppingList, getShoppingAudit,
} from '../utils/api';
import { Modal, ModalFooter, FAB, EmptyState } from '../components';
import { useToast } from '../components/Toast';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import { SortableShoppingItem } from './shopping/SortableShoppingItem';
import { ItemFormModal } from './shopping/ItemFormModal';
import { StoresSettingsModal } from './shopping/StoresSettingsModal';
import { ShareShoppingModal } from './shopping/ShareShoppingModal';
import { ShoppingHistoryModal } from './shopping/ShoppingHistoryModal';
import './shopping/ShoppingPage.css';

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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

  const itemModal = useModal<ShoppingItem>();
  const shareModal = useModal();
  const historyModal = useModal();
  const settingsModal = useModal();
  const deleteModal = useModal<ShoppingItem>();
  const deleteStoreModal = useModal<ShoppingStore>();

  const { showError } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isSharing = shareStatus.sharedWith.length > 0 || shareStatus.sharedBy.length > 0;

  const loadData = useCallback(async (showLoading = true, signal?: AbortSignal) => {
    if (showLoading) setIsLoading(true);
    try {
      const [itemsData, storesData] = await Promise.all([
        getShoppingItems(signal),
        getShoppingStores(signal),
      ]);
      setItems(itemsData);
      setStores(storesData);
      if (storesData.length > 0 && !selectedStore) {
        setSelectedStore(storesData[0].id);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(err, 'Failed to load shopping list');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [selectedStore, showError]);

  useEffect(() => {
    const ac = new AbortController();
    void loadData(true, ac.signal);
    void loadShareStatus(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync when list is shared — only while tab is visible, and refresh on re-focus
  useEffect(() => {
    if (!isSharing) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => loadData(false), 60000);
    };
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isSharing, loadData]);

  async function loadShareStatus(signal?: AbortSignal) {
    try {
      const status = await getShoppingShareStatus(signal);
      setShareStatus(status);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(err, 'Failed to load sharing status');
    }
  }

  const currentStore = stores.find(s => s.id === selectedStore);
  const filteredItems = useMemo(() => {
    // Filter by store name to handle shared lists where users have different store IDs for the same store name
    const storeName = currentStore?.name;
    let result = items
      .filter(item => item.storeName === storeName)
      .sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        return 0;
      });
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, currentStore, itemSearch]);

  const completedCount = filteredItems.filter(i => i.completed).length;
  const totalCount = filteredItems.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const openAddModal = () => itemModal.open();
  const openEditModal = (item: ShoppingItem) => itemModal.open(item);

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

  const handleSaveItem = async (values: { name: string; quantity: number }) => {
    if (!selectedStore) return;
    const previousItems = items;
    const isEdit = !!itemModal.data;
    let mutated: ShoppingItem;
    const selectedStoreName = currentStore?.name;

    if (itemModal.data) {
      mutated = { ...itemModal.data, name: values.name, quantity: values.quantity };
      setItems(items.map(i => i.id === itemModal.data!.id ? mutated : i));
    } else {
      mutated = {
        id: Date.now().toString(),
        name: values.name,
        quantity: values.quantity,
        storeId: selectedStore,
        storeName: selectedStoreName,
        completed: false,
        createdAt: new Date().toISOString(),
        isOwn: true,
      };
      setItems([...items, mutated]);
    }
    itemModal.close();

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
      const reordered = arrayMove(filteredItems, oldIndex, newIndex);
      const updatedItems = reordered.map((item, index) => ({ ...item, sortOrder: index }));

      const previousItems = items;
      setItems(items.map(i => updatedItems.find(ui => ui.id === i.id) || i));

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
    setShareStatus(prev => ({ ...prev, sharedWith: [...prev.sharedWith, newShare] }));
    setShareEmail('');
  };

  const handleUnshare = async (userId: string) => {
    const previous = shareStatus;
    setShareStatus(prev => ({
      ...prev,
      sharedWith: prev.sharedWith.filter(u => u.id !== userId),
    }));
    try {
      await unshareShoppingList(userId);
    } catch (err) {
      setShareStatus(previous);
      showError(err, 'Failed to unshare list');
    }
  };

  const handleSaveStore = async (values: { editing: ShoppingStore | null; name: string; color: string }) => {
    const previousStores = stores;
    const previousSelected = selectedStore;
    if (values.editing) {
      const updated: ShoppingStore = { ...values.editing, name: values.name, color: values.color };
      setStores(stores.map(s => s.id === updated.id ? updated : s));
      try { await updateShoppingStore(updated); }
      catch (err) { setStores(previousStores); showError(err, 'Failed to update store'); }
    } else {
      const newStore: ShoppingStore = {
        id: `store_${Date.now()}`,
        name: values.name,
        color: values.color,
      };
      setStores([...stores, newStore]);
      if (!selectedStore) setSelectedStore(newStore.id);
      try { await saveShoppingStore(newStore); }
      catch (err) {
        setStores(previousStores); setSelectedStore(previousSelected);
        showError(err, 'Failed to add store');
      }
    }
  };

  const handleDeleteStore = async (id: string) => {
    const previousStores = stores;
    const previousItems = items;
    const previousSelected = selectedStore;
    setStores(stores.filter(s => s.id !== id));
    setItems(items.filter(i => i.storeId !== id));
    if (selectedStore === id) {
      const remaining = stores.filter(s => s.id !== id);
      setSelectedStore(remaining.length > 0 ? remaining[0].id : '');
    }
    try { await apiDeleteStore(id); }
    catch (err) {
      setStores(previousStores); setItems(previousItems); setSelectedStore(previousSelected);
      showError(err, 'Failed to delete store');
    }
  };

  const sharePartners = [...shareStatus.sharedWith, ...shareStatus.sharedBy];

  return (
    <div className="shopping-page">
      <header
        className="shopping-header"
        style={{
          background: currentStore
            ? `linear-gradient(135deg, ${currentStore.color} 0%, ${currentStore.color}dd 100%)`
            : undefined,
        }}
      >
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
                <span key={partner.id} className="partner-badge" title={`Shared with ${partner.name}`}>
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

      <div className="store-tabs">
        {stores.map(store => (
          <button
            key={store.id}
            className={`store-tab ${selectedStore === store.id ? 'active' : ''}`}
            onClick={() => { setSelectedStore(store.id); setItemSearch(''); }}
            style={{
              borderColor: selectedStore === store.id ? store.color : 'transparent',
              color: selectedStore === store.id ? store.color : undefined,
            }}
          >
            {store.name}
          </button>
        ))}
        <button className="store-tab settings" onClick={() => settingsModal.open()}>
          <IoSettings size={18} />
        </button>
      </div>

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

      <div className="progress-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progress}%`,
              background: currentStore?.color || colors.primary,
            }}
          />
        </div>
        <span className="progress-text">{Math.round(progress)}%</span>
      </div>

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
            message={stores.length === 0 ? 'Add a store to get started' : 'No items yet'}
            action={stores.length === 0
              ? { label: 'Add Store', icon: IoAdd, onClick: () => settingsModal.open() }
              : { label: 'Add Item', icon: IoAdd, onClick: openAddModal }}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
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

      <FAB onClick={openAddModal} disabled={stores.length === 0} />

      <ItemFormModal
        isOpen={itemModal.isOpen}
        editingItem={itemModal.data ?? null}
        onClose={itemModal.close}
        onSubmit={handleSaveItem}
      />

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

      <StoresSettingsModal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
        stores={stores}
        onSaveStore={handleSaveStore}
        onRequestDeleteStore={(s) => deleteStoreModal.open(s)}
      />

      <ShareShoppingModal
        isOpen={shareModal.isOpen}
        onClose={shareModal.close}
        shareStatus={shareStatus}
        shareEmail={shareEmail}
        shareError={shareError}
        onShareEmailChange={setShareEmail}
        onShare={handleShare}
        onUnshare={handleUnshare}
      />

      <ShoppingHistoryModal
        isOpen={historyModal.isOpen}
        onClose={historyModal.close}
        history={auditHistory}
      />

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
