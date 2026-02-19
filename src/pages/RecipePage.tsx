import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoClose, IoTrash, IoHeart, IoHeartOutline, IoSearchOutline,
  IoRestaurantOutline, IoTime, IoPeople, IoPencil, IoLink,
  IoLogoYoutube, IoCheckmarkCircle, IoRefreshOutline,
} from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
import { Recipe, RecipeIngredient } from '../types';
import {
  getRecipes, saveRecipe, updateRecipe, deleteRecipe as apiDeleteRecipe,
  extractRecipeFromUrl,
} from '../utils/api';
import { Modal, ModalFooter, FormGroup, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
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
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const resetSwipe = () => { setSwipeOffset(0); setIsSwiping(false); };

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (e.dir === 'Left') {
        setSwipeOffset(Math.min(0, Math.max(-100, e.deltaX)));
        setIsSwiping(true);
      }
    },
    onSwiped: (e) => {
      if (e.dir === 'Left' && swipeOffset < -70) {
        onDelete();
        setTimeout(resetSwipe, 300);
      } else {
        resetSwipe();
      }
      setIsSwiping(false);
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div className="recipe-card-wrapper">
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div
        className="recipe-card"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        {...swipeHandlers}
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
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecipePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites'>('all');

  // URL extraction
  const [extractUrl, setExtractUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedOk, setExtractedOk] = useState(false);

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
  const [formThumbnail, setFormThumbnail] = useState('');
  const [formChannelName, setFormChannelName] = useState('');
  const [formSourcePlatform, setFormSourcePlatform] = useState<'youtube' | 'manual'>('manual');
  const [formIsFavorite, setFormIsFavorite] = useState(false);

  const addModal = useModal<Recipe>();
  const viewModal = useModal<Recipe>();
  const deleteModal = useModal<Recipe>();

  useEffect(() => { loadRecipes(); }, []);

  async function loadRecipes() {
    setIsLoading(true);
    const data = await getRecipes();
    setRecipes(data);
    setIsLoading(false);
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

  // ── Form helpers ──

  const resetForm = () => {
    setExtractUrl(''); setExtractError(''); setExtractedOk(false);
    setFormTitle(''); setFormDescription('');
    setFormIngredients([{ name: '' }]); setFormInstructions(['']);
    setFormPrepTime(''); setFormCookTime(''); setFormServings('');
    setFormTagInput(''); setFormTags([]);
    setFormSourceUrl(''); setFormThumbnail(''); setFormChannelName('');
    setFormSourcePlatform('manual'); setFormIsFavorite(false);
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

  const handleExtract = async () => {
    if (!extractUrl.trim()) return;
    setIsExtracting(true); setExtractError(''); setExtractedOk(false);
    try {
      const data = await extractRecipeFromUrl(extractUrl.trim());
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
      setExtractedOk(true);
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract recipe');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
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
      await updateRecipe(recipeData);
      setRecipes(prev => prev.map(r => r.id === recipeData.id ? recipeData : r));
    } else {
      await saveRecipe(recipeData);
      setRecipes(prev => [recipeData, ...prev]);
    }
    addModal.close();
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    const updated = { ...recipe, isFavorite: !recipe.isFavorite, updatedAt: new Date().toISOString() };
    await updateRecipe(updated);
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updated : r));
    if (viewModal.data?.id === recipe.id) viewModal.open(updated);
  };

  const handleDelete = async (recipe: Recipe) => {
    await apiDeleteRecipe(recipe.id);
    setRecipes(prev => prev.filter(r => r.id !== recipe.id));
    deleteModal.close();
    if (viewModal.isOpen) viewModal.close();
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
        {/* YouTube extraction — only on new recipes */}
        {!addModal.data && (
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
            onChange={e => setFormSourceUrl(e.target.value)}
            placeholder="https://…"
          />
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
              </div>
            </div>

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
            onSubmit={() => deleteModal.data && handleDelete(deleteModal.data)}
            submitText="Delete"
            submitDestructive={true}
          />
        }
      >
        <p style={{ color: '#64748B' }}>
          Are you sure you want to delete "{deleteModal.data?.title}"? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
