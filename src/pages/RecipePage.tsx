import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoClose, IoHeart, IoSearchOutline, IoRestaurantOutline,
  IoShareSocialOutline,
} from '../utils/icons';
import { Recipe, SharedRecipe } from '../types';
import {
  getRecipes, saveRecipe, updateRecipe, deleteRecipe as apiDeleteRecipe,
  shareRecipe as apiShareRecipe, getConnections, UserConnection,
  getSharedRecipes, deleteSharedRecipe as apiDeleteSharedRecipe,
  saveSharedRecipeToOwn,
} from '../utils/api';
import { Modal, ModalFooter, FAB, EmptyState } from '../components';
import { useToast } from '../components/Toast';
import { useRecipeModals } from './recipe/useRecipeModals';
import { RecipeCard } from './recipe/RecipeCard';
import { SharedRecipeCard } from './recipe/SharedRecipeCard';
import { RecipeFormModal } from './recipe/RecipeFormModal';
import { RecipeViewModal } from './recipe/RecipeViewModal';
import { ShareRecipeModal } from './recipe/ShareRecipeModal';
import logo from '../assets/logo.png';
import './recipe/RecipePage.css';

export default function RecipePage() {
  const { showError } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sharedRecipes, setSharedRecipes] = useState<SharedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'shared'>('all');

  const { add: addModal, view: viewModal, del: deleteModal, share: shareModal } = useRecipeModals();

  // Share state
  const [shareEmail, setShareEmail] = useState('');
  const [shareConnections, setShareConnections] = useState<UserConnection[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void loadAll(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll(signal?: AbortSignal) {
    setIsLoading(true);
    try {
      const [recipeData, sharedData] = await Promise.all([
        getRecipes(signal),
        getSharedRecipes(signal),
      ]);
      setRecipes(recipeData);
      setSharedRecipes(sharedData);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(err, 'Failed to load recipes');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredRecipes = useMemo(() => {
    let result = recipes;
    if (activeFilter === 'favorites') result = result.filter(r => r.isFavorite);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.tags?.some(t => t.toLowerCase().includes(q)) ||
        r.channelName?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [recipes, searchQuery, activeFilter]);

  const filteredSharedRecipes = useMemo(() => {
    if (!searchQuery.trim()) return sharedRecipes;
    const q = searchQuery.toLowerCase();
    return sharedRecipes.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.tags?.some(t => t.toLowerCase().includes(q)) ||
      r.channelName?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.sharedByName?.toLowerCase().includes(q)
    );
  }, [sharedRecipes, searchQuery]);

  const openAddModal = () => addModal.open();
  const openEditModal = (recipe: Recipe) => addModal.open(recipe);

  const handleSaveRecipe = async (recipeData: Recipe) => {
    const isEdit = !!addModal.data;
    const previousRecipes = recipes;
    if (isEdit) {
      setRecipes(prev => prev.map(r => r.id === recipeData.id ? recipeData : r));
    } else {
      setRecipes(prev => [recipeData, ...prev]);
    }
    addModal.close();
    try {
      if (isEdit) await updateRecipe(recipeData);
      else await saveRecipe(recipeData);
    } catch (err) {
      setRecipes(previousRecipes);
      showError(err, isEdit ? 'Failed to update recipe' : 'Failed to add recipe');
    }
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    const updated = { ...recipe, isFavorite: !recipe.isFavorite, updatedAt: new Date().toISOString() };
    const previousRecipes = recipes;
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updated : r));
    if (viewModal.data?.id === recipe.id) viewModal.open(updated);
    try {
      await updateRecipe(updated);
    } catch (err) {
      setRecipes(previousRecipes);
      if (viewModal.data?.id === recipe.id) viewModal.open(recipe);
      showError(err, 'Failed to update favorite');
    }
  };

  const handleDelete = async (recipe: Recipe) => {
    const previousRecipes = recipes;
    setRecipes(prev => prev.filter(r => r.id !== recipe.id));
    deleteModal.close();
    if (viewModal.isOpen) viewModal.close();
    try {
      await apiDeleteRecipe(recipe.id);
    } catch (err) {
      setRecipes(previousRecipes);
      showError(err, 'Failed to delete recipe');
    }
  };

  const handleDeleteShared = async (recipe: SharedRecipe) => {
    const previousShared = sharedRecipes;
    setSharedRecipes(prev => prev.filter(r => r.id !== recipe.id));
    deleteModal.close();
    if (viewModal.isOpen) viewModal.close();
    try {
      await apiDeleteSharedRecipe(recipe.id);
    } catch (err) {
      setSharedRecipes(previousShared);
      showError(err, 'Failed to delete shared recipe');
    }
  };

  const handleSaveToOwn = async (recipe: SharedRecipe) => {
    try {
      await saveSharedRecipeToOwn(recipe);
      const data = await getRecipes();
      setRecipes(data);
      setActiveFilter('all');
    } catch (err) {
      showError(err, 'Failed to save recipe');
    }
  };

  const openShareModal = async (recipe: Recipe) => {
    setShareEmail('');
    setShareResult(null);
    setIsSharing(false);
    shareModal.open(recipe);
    if (!connectionsLoaded) {
      const conns = await getConnections();
      setShareConnections(conns);
      setConnectionsLoaded(true);
    }
  };

  const handleShare = async (email: string) => {
    if (!shareModal.data || !email.trim()) return;
    setIsSharing(true);
    setShareResult(null);
    const result = await apiShareRecipe(shareModal.data.id, email.trim().toLowerCase());
    setIsSharing(false);
    if (result.success) {
      setShareResult({ type: 'success', message: result.message || `Shared with ${result.sharedWith?.name}!` });
      setShareEmail('');
    } else {
      setShareResult({ type: 'error', message: result.error || 'Failed to share recipe' });
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteModal.data) return;
    if ('sharedByName' in deleteModal.data) {
      handleDeleteShared(deleteModal.data as SharedRecipe);
    } else {
      handleDelete(deleteModal.data);
    }
  };

  const favoriteCount = recipes.filter(r => r.isFavorite).length;

  return (
    <div className="recipe-page">
      <header className="recipe-header">
        <div className="header-left">
          <img src={logo} alt="Almost Adult" className="header-logo" />
          <div>
            <h1 className="header-title">Recipes</h1>
            <p className="header-subtitle">
              {recipes.length} saved · {favoriteCount} favorite{favoriteCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="recipe-search-container">
        <div className="recipe-search-bar">
          <IoSearchOutline size={18} className="search-icon" />
          <input
            className="search-input"
            type="text"
            placeholder="Search recipes, tags..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              <IoClose size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="recipe-filter-tabs">
        <button
          className={`recipe-filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All ({recipes.length})
        </button>
        <button
          className={`recipe-filter-tab ${activeFilter === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveFilter('favorites')}
        >
          <IoHeart size={13} /> Favorites ({favoriteCount})
        </button>
        <button
          className={`recipe-filter-tab ${activeFilter === 'shared' ? 'active' : ''}`}
          onClick={() => setActiveFilter('shared')}
        >
          <IoShareSocialOutline size={13} /> Shared
          {sharedRecipes.length > 0 && (
            <span className="shared-badge">{sharedRecipes.length}</span>
          )}
        </button>
      </div>

      <div className="recipe-container">
        {isLoading ? (
          <div className="recipe-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="recipe-skeleton">
                <div className="skeleton recipe-skeleton-thumb" />
                <div className="skeleton recipe-skeleton-text long" />
                <div className="skeleton recipe-skeleton-text short" />
              </div>
            ))}
          </div>
        ) : activeFilter === 'shared' ? (
          filteredSharedRecipes.length === 0 ? (
            <EmptyState
              icon={IoShareSocialOutline}
              message={
                searchQuery
                  ? 'No shared recipes match your search'
                  : 'No recipes shared with you yet'
              }
            />
          ) : (
            <div className="recipe-grid">
              {filteredSharedRecipes.map(recipe => (
                <SharedRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onView={() => viewModal.open(recipe)}
                  onSaveToOwn={() => handleSaveToOwn(recipe)}
                  onDelete={() => deleteModal.open(recipe)}
                />
              ))}
            </div>
          )
        ) : filteredRecipes.length === 0 ? (
          <EmptyState
            icon={IoRestaurantOutline}
            message={
              activeFilter === 'favorites'
                ? 'No favorite recipes yet'
                : searchQuery
                ? 'No recipes match your search'
                : 'No recipes yet — add one!'
            }
            action={
              activeFilter === 'all' && !searchQuery
                ? { label: 'Add Recipe', icon: IoAdd, onClick: openAddModal }
                : undefined
            }
          />
        ) : (
          <div className="recipe-grid">
            {filteredRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onView={() => viewModal.open(recipe)}
                onEdit={() => openEditModal(recipe)}
                onDelete={() => deleteModal.open(recipe)}
                onToggleFavorite={() => handleToggleFavorite(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      <FAB onClick={openAddModal} />

      <RecipeFormModal
        isOpen={addModal.isOpen}
        editingRecipe={addModal.data ?? null}
        existingRecipes={recipes}
        onClose={addModal.close}
        onSubmit={handleSaveRecipe}
      />

      <RecipeViewModal
        isOpen={viewModal.isOpen}
        recipe={viewModal.data ?? null}
        onClose={viewModal.close}
        onToggleFavorite={handleToggleFavorite}
        onShare={openShareModal}
        onEdit={openEditModal}
        onDelete={(r) => deleteModal.open(r)}
        onSaveToOwn={handleSaveToOwn}
      />

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Recipe"
        footer={
          <ModalFooter
            onCancel={deleteModal.close}
            onSubmit={handleConfirmDelete}
            submitText="Delete"
            submitDestructive={true}
          />
        }
      >
        <p style={{ color: '#64748B' }}>
          Are you sure you want to {deleteModal.data && 'sharedByName' in deleteModal.data ? 'remove' : 'delete'} "{deleteModal.data?.title}"? This cannot be undone.
        </p>
      </Modal>

      <ShareRecipeModal
        isOpen={shareModal.isOpen}
        recipe={shareModal.data ?? null}
        email={shareEmail}
        isSharing={isSharing}
        result={shareResult}
        connections={shareConnections}
        onClose={shareModal.close}
        onEmailChange={(v) => { setShareEmail(v); setShareResult(null); }}
        onShare={handleShare}
      />
    </div>
  );
}
