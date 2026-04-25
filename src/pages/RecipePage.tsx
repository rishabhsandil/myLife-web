import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoClose, IoTrash, IoHeart, IoHeartOutline, IoSearchOutline,
  IoRestaurantOutline, IoTime, IoPeople, IoPencil, IoLink,
  IoLogoYoutube, IoCheckmarkCircle, IoRefreshOutline, IoClipboardOutline,
  IoShareSocialOutline, IoPersonOutline, IoSendOutline,
  IoDownloadOutline,
} from '../utils/icons';
import { Recipe, RecipeIngredient, SharedRecipe } from '../types';
import {
  getRecipes, saveRecipe, updateRecipe, deleteRecipe as apiDeleteRecipe,
  extractRecipeFromUrl, parseRecipeFromText, shareRecipe as apiShareRecipe,
  getConnections, UserConnection,
  getSharedRecipes, deleteSharedRecipe as apiDeleteSharedRecipe,
  saveSharedRecipeToOwn,
} from '../utils/api';
import { Modal, ModalFooter, FormGroup, FAB, EmptyState, SortableSwipeItem } from '../components';
import { useToast } from '../components/Toast';
import { useRecipeModals } from './recipe/useRecipeModals';
import logo from '../assets/logo.png';
import './RecipePage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${min}m`;
}

// ─── Swipeable Recipe Card ────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: Recipe;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

function RecipeCard({ recipe, onView, onEdit, onDelete, onToggleFavorite }: RecipeCardProps) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <SortableSwipeItem
      onSwipeDelete={onDelete}
      wrapperClassName="recipe-card-wrapper"
      contentClassName="recipe-card"
    >
      {/* Thumbnail */}
      <div
        className={recipe.thumbnail ? 'recipe-thumbnail' : 'recipe-thumbnail-placeholder'}
        onClick={onView}
      >
        {recipe.thumbnail
          ? <img src={recipe.thumbnail} alt={recipe.title} loading="lazy" />
          : <IoRestaurantOutline size={36} />
        }
        {recipe.sourcePlatform === 'youtube' && (
          <div className="recipe-platform-badge">
            <IoLogoYoutube size={13} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="recipe-card-body" onClick={onView}>
        <h3 className="recipe-card-title">{recipe.title}</h3>
        {recipe.channelName && (
          <p className="recipe-card-channel">{recipe.channelName}</p>
        )}
        <div className="recipe-card-meta">
          {totalTime > 0 && (
            <span className="recipe-meta-item">
              <IoTime size={12} /> {formatTime(totalTime)}
            </span>
          )}
          {(recipe.servings ?? 0) > 0 && (
            <span className="recipe-meta-item">
              <IoPeople size={12} /> {recipe.servings}
            </span>
          )}
          {recipe.ingredients?.length > 0 && (
            <span className="recipe-meta-item">
              {recipe.ingredients.length} ingr.
            </span>
          )}
        </div>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="recipe-tags">
            {recipe.tags.slice(0, 3).map(tag => (
              <span key={tag} className="recipe-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="recipe-card-actions">
        <button
          className="recipe-action-btn"
          onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
          title={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {recipe.isFavorite
            ? <IoHeart size={18} color="#EF4444" />
            : <IoHeartOutline size={18} />
          }
        </button>
        <button
          className="recipe-action-btn"
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title="Edit recipe"
        >
          <IoPencil size={16} />
        </button>
      </div>
    </SortableSwipeItem>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecipePage() {
  const { showError } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sharedRecipes, setSharedRecipes] = useState<SharedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'shared'>('all');

  // URL extraction
  const [importTab, setImportTab] = useState<'youtube' | 'paste'>('youtube');
  const [extractUrl, setExtractUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedOk, setExtractedOk] = useState(false);
  // Text paste extraction
  const [pasteText, setPasteText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [parsedOk, setParsedOk] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIngredients, setFormIngredients] = useState<RecipeIngredient[]>([{ name: '' }]);
  const [formInstructions, setFormInstructions] = useState<string[]>(['']);
  const [formPrepTime, setFormPrepTime] = useState('');
  const [formCookTime, setFormCookTime] = useState('');
  const [formServings, setFormServings] = useState('');
  const [formTagInput, setFormTagInput] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formSourceUrl, setFormSourceUrl] = useState('');
  const [urlDuplicateError, setUrlDuplicateError] = useState('');
  const [formThumbnail, setFormThumbnail] = useState('');
  const [formChannelName, setFormChannelName] = useState('');
  const [formSourcePlatform, setFormSourcePlatform] = useState<'youtube' | 'manual'>('manual');
  const [formIsFavorite, setFormIsFavorite] = useState(false);

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

  async function loadRecipes() {
    const data = await getRecipes();
    setRecipes(data);
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

  // ── Form helpers ──

  const resetForm = () => {
    setExtractUrl(''); setExtractError(''); setExtractedOk(false);
    setFormTitle(''); setFormDescription('');
    setFormIngredients([{ name: '' }]); setFormInstructions(['']);
    setFormPrepTime(''); setFormCookTime(''); setFormServings('');
    setFormTagInput(''); setFormTags([]);
    setFormSourceUrl(''); setFormThumbnail(''); setFormChannelName('');
    setFormSourcePlatform('manual'); setFormIsFavorite(false);
    setUrlDuplicateError('');
    setImportTab('youtube');
    setPasteText(''); setPasteError(''); setParsedOk(false);
  };

  const openAddModal = () => { resetForm(); addModal.open(); };

  const openEditModal = (recipe: Recipe) => {
    setExtractUrl(''); setExtractError(''); setExtractedOk(false);
    setFormTitle(recipe.title);
    setFormDescription(recipe.description || '');
    setFormIngredients(recipe.ingredients?.length ? recipe.ingredients : [{ name: '' }]);
    setFormInstructions(recipe.instructions?.length ? recipe.instructions : ['']);
    setFormPrepTime(recipe.prepTime?.toString() || '');
    setFormCookTime(recipe.cookTime?.toString() || '');
    setFormServings(recipe.servings?.toString() || '');
    setFormTagInput(''); setFormTags(recipe.tags || []);
    setFormSourceUrl(recipe.sourceUrl || '');
    setFormThumbnail(recipe.thumbnail || '');
    setFormChannelName(recipe.channelName || '');
    setFormSourcePlatform(recipe.sourcePlatform || 'manual');
    setFormIsFavorite(recipe.isFavorite || false);
    addModal.open(recipe);
  };

  const applyExtractedData = (data: Awaited<ReturnType<typeof extractRecipeFromUrl>>) => {
    if (data.title) setFormTitle(data.title);
    if (data.description) setFormDescription(data.description);
    if (data.ingredients?.length) setFormIngredients(data.ingredients as RecipeIngredient[]);
    if (data.instructions?.length) setFormInstructions(data.instructions);
    if (data.prepTime) setFormPrepTime(data.prepTime.toString());
    if (data.cookTime) setFormCookTime(data.cookTime.toString());
    if (data.servings) setFormServings(data.servings.toString());
    if (data.tags?.length) setFormTags(data.tags);
    if (data.sourceUrl) setFormSourceUrl(data.sourceUrl);
    if (data.thumbnail) setFormThumbnail(data.thumbnail);
    if (data.channelName) setFormChannelName(data.channelName);
    if (data.sourcePlatform) setFormSourcePlatform(data.sourcePlatform);
  };

  const handleExtract = async () => {
    if (!extractUrl.trim()) return;
    setIsExtracting(true); setExtractError(''); setExtractedOk(false);
    try {
      const data = await extractRecipeFromUrl(extractUrl.trim());
      applyExtractedData(data);
      setExtractedOk(true);
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract recipe');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleParseText = async () => {
    if (!pasteText.trim()) return;
    setIsParsing(true); setPasteError(''); setParsedOk(false);
    try {
      const data = await parseRecipeFromText(pasteText.trim());
      applyExtractedData(data);
      setParsedOk(true);
    } catch (err: unknown) {
      setPasteError(err instanceof Error ? err.message : 'Failed to parse recipe');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    const trimmedUrl = formSourceUrl.trim();
    if (trimmedUrl) {
      const editingId = addModal.data?.id;
      const duplicate = recipes.find(r => r.sourceUrl === trimmedUrl && r.id !== editingId);
      if (duplicate) {
        setUrlDuplicateError(`This URL is already used by "${duplicate.title}".`);
        return;
      }
    }
    setUrlDuplicateError('');
    const recipeData: Recipe = {
      id: addModal.data?.id || Date.now().toString(),
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      ingredients: formIngredients.filter(i => i.name.trim()),
      instructions: formInstructions.filter(s => s.trim()),
      prepTime: formPrepTime ? parseInt(formPrepTime) : undefined,
      cookTime: formCookTime ? parseInt(formCookTime) : undefined,
      servings: formServings ? parseInt(formServings) : undefined,
      tags: formTags.filter(t => t.trim()),
      sourceUrl: formSourceUrl.trim() || undefined,
      sourcePlatform: formSourcePlatform,
      thumbnail: formThumbnail.trim() || undefined,
      channelName: formChannelName.trim() || undefined,
      isFavorite: formIsFavorite,
      createdAt: addModal.data?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (addModal.data) {
      const previousRecipes = recipes;
      setRecipes(prev => prev.map(r => r.id === recipeData.id ? recipeData : r));
      addModal.close();
      try {
        await updateRecipe(recipeData);
      } catch (err) {
        setRecipes(previousRecipes);
        showError(err, 'Failed to update recipe');
      }
    } else {
      const previousRecipes = recipes;
      setRecipes(prev => [recipeData, ...prev]);
      addModal.close();
      try {
        await saveRecipe(recipeData);
      } catch (err) {
        setRecipes(previousRecipes);
        showError(err, 'Failed to add recipe');
      }
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
      await loadRecipes();
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

  // Ingredient helpers
  const updateIngredient = (i: number, field: keyof RecipeIngredient, val: string) =>
    setFormIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing));
  const addIngredient = () => setFormIngredients(prev => [...prev, { name: '' }]);
  const removeIngredient = (i: number) => {
    if (formIngredients.length > 1) setFormIngredients(prev => prev.filter((_, idx) => idx !== i));
  };

  // Instruction helpers
  const updateInstruction = (i: number, val: string) =>
    setFormInstructions(prev => prev.map((s, idx) => idx === i ? val : s));
  const addInstruction = () => setFormInstructions(prev => [...prev, '']);
  const removeInstruction = (i: number) => {
    if (formInstructions.length > 1) setFormInstructions(prev => prev.filter((_, idx) => idx !== i));
  };

  // Tag helpers
  const addTag = () => {
    const tag = formTagInput.trim();
    if (tag && !formTags.includes(tag)) setFormTags(prev => [...prev, tag]);
    setFormTagInput('');
  };

  const viewRecipe = viewModal.data;
  const isViewingShared = viewRecipe && 'sharedByName' in viewRecipe;
  const favoriteCount = recipes.filter(r => r.isFavorite).length;

  // ── Render ──

  return (
    <div className="recipe-page">
      {/* Header */}
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

      {/* Search */}
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

      {/* Filter Tabs */}
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

      {/* Grid */}
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
          /* Shared recipes view */
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
                <div key={recipe.id} className="recipe-card-wrapper">
                  <div className="swipe-delete-bg">
                    <IoTrash size={20} />
                  </div>
                  <div className="recipe-card shared-recipe-card">
                    {/* Thumbnail */}
                    <div
                      className={recipe.thumbnail ? 'recipe-thumbnail' : 'recipe-thumbnail-placeholder'}
                      onClick={() => viewModal.open(recipe)}
                    >
                      {recipe.thumbnail
                        ? <img src={recipe.thumbnail} alt={recipe.title} loading="lazy" />
                        : <IoRestaurantOutline size={36} />
                      }
                      {recipe.sourcePlatform === 'youtube' && (
                        <div className="recipe-platform-badge">
                          <IoLogoYoutube size={13} />
                        </div>
                      )}
                    </div>
                    {/* Card body */}
                    <div className="recipe-card-body" onClick={() => viewModal.open(recipe)}>
                      <h3 className="recipe-card-title">{recipe.title}</h3>
                      <p className="shared-by-label">
                        <IoPersonOutline size={11} /> From {recipe.sharedByName}
                      </p>
                      <div className="recipe-card-meta">
                        {((recipe.prepTime || 0) + (recipe.cookTime || 0)) > 0 && (
                          <span className="recipe-meta-item">
                            <IoTime size={12} /> {formatTime((recipe.prepTime || 0) + (recipe.cookTime || 0))}
                          </span>
                        )}
                        {(recipe.servings ?? 0) > 0 && (
                          <span className="recipe-meta-item">
                            <IoPeople size={12} /> {recipe.servings}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="recipe-card-actions">
                      <button
                        className="recipe-action-btn"
                        onClick={e => { e.stopPropagation(); handleSaveToOwn(recipe); }}
                        title="Save to my recipes"
                      >
                        <IoDownloadOutline size={17} />
                      </button>
                      <button
                        className="recipe-action-btn"
                        onClick={e => { e.stopPropagation(); deleteModal.open(recipe); }}
                        title="Remove"
                      >
                        <IoTrash size={15} />
                      </button>
                    </div>
                  </div>
                </div>
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

      {/* ── Add / Edit Modal ── */}
      <Modal
        isOpen={addModal.isOpen}
        onClose={addModal.close}
        title={addModal.data ? 'Edit Recipe' : 'Add Recipe'}
        footer={
          <ModalFooter
            onCancel={addModal.close}
            onSubmit={handleSave}
            submitText={addModal.data ? 'Save Changes' : 'Add Recipe'}
            submitDisabled={!formTitle.trim()}
          />
        }
      >
        {/* Import section — only on new recipes */}
        {!addModal.data && (
          <div className="import-section">
            <div className="import-tabs">
              <button
                className={`import-tab${importTab === 'youtube' ? ' active' : ''}`}
                onClick={() => setImportTab('youtube')}
                type="button"
              >
                <IoLogoYoutube size={14} /> YouTube
              </button>
              <button
                className={`import-tab${importTab === 'paste' ? ' active' : ''}`}
                onClick={() => setImportTab('paste')}
                type="button"
              >
                <IoClipboardOutline size={14} /> Paste Text
              </button>
            </div>

            {importTab === 'youtube' ? (
              <FormGroup label="Import from YouTube (optional)">
                <div className="extract-row">
                  <input
                    type="url"
                    value={extractUrl}
                    onChange={e => { setExtractUrl(e.target.value); setExtractError(''); setExtractedOk(false); }}
                    placeholder="Paste YouTube URL..."
                    onKeyDown={e => e.key === 'Enter' && handleExtract()}
                  />
                  <button
                    className="extract-btn"
                    onClick={handleExtract}
                    disabled={!extractUrl.trim() || isExtracting}
                  >
                    {isExtracting
                      ? <IoRefreshOutline size={17} className="spin" />
                      : <IoLogoYoutube size={17} />
                    }
                    {isExtracting ? 'Extracting...' : 'Extract'}
                  </button>
                </div>
                {extractError && <p className="extract-error">{extractError}</p>}
                {extractedOk && (
                  <p className="extract-success">
                    <IoCheckmarkCircle size={14} /> Recipe extracted! Review the fields below.
                  </p>
                )}
              </FormGroup>
            ) : (
              <FormGroup label="Paste recipe text (optional)">
                <textarea
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setPasteError(''); setParsedOk(false); }}
                  placeholder="Paste any recipe text here — ingredients, steps, blog post, etc."
                  rows={5}
                  style={{ resize: 'vertical' }}
                />
                <button
                  className="extract-btn"
                  style={{ marginTop: '6px', width: '100%' }}
                  onClick={handleParseText}
                  disabled={!pasteText.trim() || isParsing}
                >
                  {isParsing
                    ? <IoRefreshOutline size={17} className="spin" />
                    : <IoClipboardOutline size={17} />
                  }
                  {isParsing ? 'Parsing...' : 'Parse Recipe'}
                </button>
                {pasteError && <p className="extract-error">{pasteError}</p>}
                {parsedOk && (
                  <p className="extract-success">
                    <IoCheckmarkCircle size={14} /> Recipe parsed! Review the fields below.
                  </p>
                )}
              </FormGroup>
            )}
          </div>
        )}

        {/* Thumbnail preview */}
        {formThumbnail && (
          <div className="form-thumbnail-preview">
            <img src={formThumbnail} alt="thumbnail" />
            <button className="thumb-remove-btn" onClick={() => setFormThumbnail('')}>
              <IoClose size={14} />
            </button>
          </div>
        )}

        <FormGroup label="Title *">
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Recipe name"
            autoFocus={!!addModal.data}
          />
        </FormGroup>

        <FormGroup label="Description (optional)">
          <textarea
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Brief description of the dish..."
            rows={2}
          />
        </FormGroup>

        {/* Time + servings */}
        <div className="form-time-row">
          <FormGroup label="Prep (min)">
            <input
              type="number"
              min="0"
              value={formPrepTime}
              onChange={e => setFormPrepTime(e.target.value)}
              placeholder="0"
            />
          </FormGroup>
          <FormGroup label="Cook (min)">
            <input
              type="number"
              min="0"
              value={formCookTime}
              onChange={e => setFormCookTime(e.target.value)}
              placeholder="0"
            />
          </FormGroup>
          <FormGroup label="Servings">
            <input
              type="number"
              min="1"
              value={formServings}
              onChange={e => setFormServings(e.target.value)}
              placeholder="2"
            />
          </FormGroup>
        </div>

        {/* Ingredients */}
        <FormGroup label="Ingredients">
          <div className="ingredient-list">
            {formIngredients.map((ing, i) => (
              <div key={i} className="ingredient-row">
                <input
                  type="text"
                  value={ing.amount || ''}
                  onChange={e => updateIngredient(i, 'amount', e.target.value)}
                  placeholder="Amt"
                  className="ing-amount"
                />
                <input
                  type="text"
                  value={ing.unit || ''}
                  onChange={e => updateIngredient(i, 'unit', e.target.value)}
                  placeholder="Unit"
                  className="ing-unit"
                />
                <input
                  type="text"
                  value={ing.name}
                  onChange={e => updateIngredient(i, 'name', e.target.value)}
                  placeholder="Ingredient"
                  className="ing-name"
                />
                <button className="remove-row-btn" onClick={() => removeIngredient(i)}>
                  <IoClose size={15} />
                </button>
              </div>
            ))}
            <button className="add-row-btn" onClick={addIngredient}>
              <IoAdd size={15} /> Add Ingredient
            </button>
          </div>
        </FormGroup>

        {/* Instructions */}
        <FormGroup label="Instructions">
          <div className="instruction-list">
            {formInstructions.map((step, i) => (
              <div key={i} className="instruction-row">
                <span className="step-number">{i + 1}</span>
                <textarea
                  value={step}
                  onChange={e => updateInstruction(i, e.target.value)}
                  placeholder={`Step ${i + 1}…`}
                  rows={2}
                />
                <button className="remove-row-btn" onClick={() => removeInstruction(i)}>
                  <IoClose size={15} />
                </button>
              </div>
            ))}
            <button className="add-row-btn" onClick={addInstruction}>
              <IoAdd size={15} /> Add Step
            </button>
          </div>
        </FormGroup>

        {/* Tags */}
        <FormGroup label="Tags (optional)">
          <div className="tags-input-row">
            <input
              type="text"
              value={formTagInput}
              onChange={e => setFormTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="e.g. Italian, pasta, quick…"
            />
            <button className="add-tag-btn" onClick={addTag} disabled={!formTagInput.trim()}>
              <IoAdd size={16} />
            </button>
          </div>
          {formTags.length > 0 && (
            <div className="tags-list">
              {formTags.map(tag => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button onClick={() => setFormTags(prev => prev.filter(t => t !== tag))}>
                    <IoClose size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </FormGroup>

        {/* Source URL (auto-filled from extraction or manually) */}
        <FormGroup label="Source URL (optional)">
          <input
            type="url"
            value={formSourceUrl}
            onChange={e => { setFormSourceUrl(e.target.value); setUrlDuplicateError(''); }}
            placeholder="https://…"
          />
          {urlDuplicateError && (
            <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '4px' }}>{urlDuplicateError}</p>
          )}
        </FormGroup>

        {/* Favorite toggle */}
        <label className="favorite-toggle">
          <input
            type="checkbox"
            checked={formIsFavorite}
            onChange={e => setFormIsFavorite(e.target.checked)}
          />
          <span>Mark as favorite</span>
          <IoHeart size={15} color={formIsFavorite ? '#EF4444' : '#94A3B8'} />
        </label>
      </Modal>

      {/* ── View Recipe Modal ── */}
      {viewRecipe && (
        <Modal
          isOpen={viewModal.isOpen}
          onClose={viewModal.close}
          title=""
        >
          <div className="recipe-view">
            {viewRecipe.thumbnail && (
              <div className="recipe-view-thumbnail">
                <img src={viewRecipe.thumbnail} alt={viewRecipe.title} />
              </div>
            )}

            <div className="recipe-view-header">
              <h2 className="recipe-view-title">{viewRecipe.title}</h2>
              <div className="recipe-view-actions">
                {isViewingShared ? (
                  /* Shared recipe actions */
                  <>
                    <button
                      className="recipe-view-btn"
                      onClick={() => { handleSaveToOwn(viewRecipe as SharedRecipe); viewModal.close(); }}
                      title="Save to my recipes"
                    >
                      <IoDownloadOutline size={20} />
                    </button>
                    <button
                      className="recipe-view-btn danger"
                      onClick={() => { viewModal.close(); deleteModal.open(viewRecipe); }}
                      title="Remove"
                    >
                      <IoTrash size={20} />
                    </button>
                  </>
                ) : (
                  /* Own recipe actions */
                  <>
                    <button
                      className="recipe-view-btn"
                      onClick={() => handleToggleFavorite(viewRecipe)}
                      title={viewRecipe.isFavorite ? 'Remove favorite' : 'Add to favorites'}
                    >
                      {viewRecipe.isFavorite
                        ? <IoHeart size={22} color="#EF4444" />
                        : <IoHeartOutline size={22} />
                      }
                    </button>
                    <button
                      className="recipe-view-btn"
                      onClick={() => openShareModal(viewRecipe)}
                      title="Share recipe"
                    >
                      <IoShareSocialOutline size={20} />
                    </button>
                    <button
                      className="recipe-view-btn"
                      onClick={() => { viewModal.close(); openEditModal(viewRecipe); }}
                      title="Edit"
                    >
                      <IoPencil size={20} />
                    </button>
                    <button
                      className="recipe-view-btn danger"
                      onClick={() => { viewModal.close(); deleteModal.open(viewRecipe); }}
                      title="Delete"
                    >
                      <IoTrash size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {isViewingShared && (
              <p className="recipe-view-shared-by">
                <IoPersonOutline size={14} />
                Shared by {(viewRecipe as SharedRecipe).sharedByName}
              </p>
            )}

            {viewRecipe.channelName && (
              <p className="recipe-view-channel">
                {viewRecipe.sourcePlatform === 'youtube' && <IoLogoYoutube size={14} color="#FF0000" />}
                {viewRecipe.channelName}
              </p>
            )}

            {/* Meta chips */}
            <div className="recipe-view-meta">
              {(viewRecipe.prepTime ?? 0) > 0 && (
                <div className="recipe-meta-chip">
                  <IoTime size={14} />
                  <span>Prep: {formatTime(viewRecipe.prepTime!)}</span>
                </div>
              )}
              {(viewRecipe.cookTime ?? 0) > 0 && (
                <div className="recipe-meta-chip">
                  <IoTime size={14} />
                  <span>Cook: {formatTime(viewRecipe.cookTime!)}</span>
                </div>
              )}
              {(viewRecipe.servings ?? 0) > 0 && (
                <div className="recipe-meta-chip">
                  <IoPeople size={14} />
                  <span>{viewRecipe.servings} serving{viewRecipe.servings !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {viewRecipe.description && (
              <p className="recipe-view-description">{viewRecipe.description}</p>
            )}

            {viewRecipe.tags && viewRecipe.tags.length > 0 && (
              <div className="recipe-view-tags">
                {viewRecipe.tags.map(tag => (
                  <span key={tag} className="recipe-tag">{tag}</span>
                ))}
              </div>
            )}

            {/* Ingredients */}
            {viewRecipe.ingredients && viewRecipe.ingredients.length > 0 && (
              <div className="recipe-view-section">
                <h3 className="recipe-section-title">
                  Ingredients ({viewRecipe.ingredients.length})
                </h3>
                <ul className="recipe-ingredients-list">
                  {viewRecipe.ingredients.map((ing, i) => (
                    <li key={i} className="recipe-ingredient-item">
                      {(ing.amount || ing.unit) && (
                        <span className="ingredient-qty">
                          {ing.amount}{ing.unit ? ` ${ing.unit}` : ''}
                        </span>
                      )}
                      <span className="ingredient-name">{ing.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions */}
            {viewRecipe.instructions && viewRecipe.instructions.length > 0 && (
              <div className="recipe-view-section">
                <h3 className="recipe-section-title">
                  Instructions ({viewRecipe.instructions.length} steps)
                </h3>
                <ol className="recipe-instructions-list">
                  {viewRecipe.instructions.map((step, i) => (
                    <li key={i} className="recipe-instruction-item">
                      <span className="instruction-number">{i + 1}</span>
                      <span className="instruction-text">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Source link */}
            {viewRecipe.sourceUrl && (
              <a
                href={viewRecipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="recipe-source-link"
              >
                <IoLink size={14} />
                View original source
              </a>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Recipe"
        footer={
          <ModalFooter
            onCancel={deleteModal.close}
            onSubmit={() => {
              if (!deleteModal.data) return;
              if ('sharedByName' in deleteModal.data) {
                handleDeleteShared(deleteModal.data as SharedRecipe);
              } else {
                handleDelete(deleteModal.data);
              }
            }}
            submitText="Delete"
            submitDestructive={true}
          />
        }
      >
        <p style={{ color: '#64748B' }}>
          Are you sure you want to {deleteModal.data && 'sharedByName' in deleteModal.data ? 'remove' : 'delete'} "{deleteModal.data?.title}"? This cannot be undone.
        </p>
      </Modal>

      {/* ── Share Recipe Modal ── */}
      <Modal
        isOpen={shareModal.isOpen}
        onClose={shareModal.close}
        title="Share Recipe"
      >
        <div className="share-recipe-modal">
          <p className="share-recipe-name">
            Sharing: <strong>{shareModal.data?.title}</strong>
          </p>
          <p className="share-recipe-note">
            A copy of this recipe will be added to the other user's recipes.
          </p>

          {/* Email input */}
          <div className="share-email-row">
            <input
              type="email"
              value={shareEmail}
              onChange={e => { setShareEmail(e.target.value); setShareResult(null); }}
              placeholder="Enter email address..."
              onKeyDown={e => e.key === 'Enter' && handleShare(shareEmail)}
              disabled={isSharing}
            />
            <button
              className="share-send-btn"
              onClick={() => handleShare(shareEmail)}
              disabled={!shareEmail.trim() || isSharing}
            >
              {isSharing
                ? <IoRefreshOutline size={17} className="spin" />
                : <IoSendOutline size={17} />
              }
            </button>
          </div>

          {/* Result message */}
          {shareResult && (
            <p className={`share-result ${shareResult.type}`}>
              {shareResult.type === 'success' && <IoCheckmarkCircle size={14} />}
              {shareResult.message}
            </p>
          )}

          {/* Quick share from connections */}
          {shareConnections.length > 0 && (
            <div className="share-connections">
              <p className="share-connections-label">Quick share with connections</p>
              <div className="share-connections-list">
                {shareConnections.map(conn => (
                  <button
                    key={conn.id}
                    className="share-connection-item"
                    onClick={() => handleShare(conn.email)}
                    disabled={isSharing}
                  >
                    <div className="share-conn-avatar">
                      <IoPersonOutline size={16} />
                    </div>
                    <div className="share-conn-info">
                      <span className="share-conn-name">{conn.name}</span>
                      <span className="share-conn-email">{conn.email}</span>
                    </div>
                    <IoSendOutline size={14} className="share-conn-send" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
