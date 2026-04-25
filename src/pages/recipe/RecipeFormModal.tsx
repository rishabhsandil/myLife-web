import { useState, useEffect } from 'react';
import {
  IoAdd, IoClose, IoHeart, IoLogoYoutube, IoCheckmarkCircle,
  IoRefreshOutline, IoClipboardOutline,
} from '../../utils/icons';
import { Recipe, RecipeIngredient } from '../../types';
import { extractRecipeFromUrl, parseRecipeFromText } from '../../utils/api';
import { Modal, ModalFooter, FormGroup } from '../../components';

interface RecipeFormModalProps {
  isOpen: boolean;
  editingRecipe: Recipe | null;
  existingRecipes: Recipe[];
  onClose: () => void;
  onSubmit: (recipe: Recipe) => void;
}

export function RecipeFormModal({
  isOpen, editingRecipe, existingRecipes, onClose, onSubmit,
}: RecipeFormModalProps) {
  // Import sources
  const [importTab, setImportTab] = useState<'youtube' | 'paste'>('youtube');
  const [extractUrl, setExtractUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedOk, setExtractedOk] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [parsedOk, setParsedOk] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([{ name: '' }]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [urlDuplicateError, setUrlDuplicateError] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [channelName, setChannelName] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState<'youtube' | 'manual'>('manual');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setExtractUrl(''); setExtractError(''); setExtractedOk(false);
    setPasteText(''); setPasteError(''); setParsedOk(false);
    setImportTab('youtube');
    setUrlDuplicateError('');
    setTagInput('');

    if (editingRecipe) {
      setTitle(editingRecipe.title);
      setDescription(editingRecipe.description || '');
      setIngredients(editingRecipe.ingredients?.length ? editingRecipe.ingredients : [{ name: '' }]);
      setInstructions(editingRecipe.instructions?.length ? editingRecipe.instructions : ['']);
      setPrepTime(editingRecipe.prepTime?.toString() || '');
      setCookTime(editingRecipe.cookTime?.toString() || '');
      setServings(editingRecipe.servings?.toString() || '');
      setTags(editingRecipe.tags || []);
      setSourceUrl(editingRecipe.sourceUrl || '');
      setThumbnail(editingRecipe.thumbnail || '');
      setChannelName(editingRecipe.channelName || '');
      setSourcePlatform(editingRecipe.sourcePlatform || 'manual');
      setIsFavorite(editingRecipe.isFavorite || false);
    } else {
      setTitle(''); setDescription('');
      setIngredients([{ name: '' }]); setInstructions(['']);
      setPrepTime(''); setCookTime(''); setServings('');
      setTags([]); setSourceUrl(''); setThumbnail('');
      setChannelName(''); setSourcePlatform('manual'); setIsFavorite(false);
    }
  }, [isOpen, editingRecipe]);

  const applyExtractedData = (data: Awaited<ReturnType<typeof extractRecipeFromUrl>>) => {
    if (data.title) setTitle(data.title);
    if (data.description) setDescription(data.description);
    if (data.ingredients?.length) setIngredients(data.ingredients as RecipeIngredient[]);
    if (data.instructions?.length) setInstructions(data.instructions);
    if (data.prepTime) setPrepTime(data.prepTime.toString());
    if (data.cookTime) setCookTime(data.cookTime.toString());
    if (data.servings) setServings(data.servings.toString());
    if (data.tags?.length) setTags(data.tags);
    if (data.sourceUrl) setSourceUrl(data.sourceUrl);
    if (data.thumbnail) setThumbnail(data.thumbnail);
    if (data.channelName) setChannelName(data.channelName);
    if (data.sourcePlatform) setSourcePlatform(data.sourcePlatform);
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

  const handleSave = () => {
    if (!title.trim()) return;
    const trimmedUrl = sourceUrl.trim();
    if (trimmedUrl) {
      const editingId = editingRecipe?.id;
      const duplicate = existingRecipes.find(r => r.sourceUrl === trimmedUrl && r.id !== editingId);
      if (duplicate) {
        setUrlDuplicateError(`This URL is already used by "${duplicate.title}".`);
        return;
      }
    }
    setUrlDuplicateError('');
    const recipeData: Recipe = {
      id: editingRecipe?.id || Date.now().toString(),
      title: title.trim(),
      description: description.trim() || undefined,
      ingredients: ingredients.filter(i => i.name.trim()),
      instructions: instructions.filter(s => s.trim()),
      prepTime: prepTime ? parseInt(prepTime) : undefined,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      servings: servings ? parseInt(servings) : undefined,
      tags: tags.filter(t => t.trim()),
      sourceUrl: trimmedUrl || undefined,
      sourcePlatform,
      thumbnail: thumbnail.trim() || undefined,
      channelName: channelName.trim() || undefined,
      isFavorite,
      createdAt: editingRecipe?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSubmit(recipeData);
  };

  const updateIngredient = (i: number, field: keyof RecipeIngredient, val: string) =>
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing));
  const addIngredient = () => setIngredients(prev => [...prev, { name: '' }]);
  const removeIngredient = (i: number) => {
    if (ingredients.length > 1) setIngredients(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateInstruction = (i: number, val: string) =>
    setInstructions(prev => prev.map((s, idx) => idx === i ? val : s));
  const addInstruction = () => setInstructions(prev => [...prev, '']);
  const removeInstruction = (i: number) => {
    if (instructions.length > 1) setInstructions(prev => prev.filter((_, idx) => idx !== i));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag]);
    setTagInput('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingRecipe ? 'Edit Recipe' : 'Add Recipe'}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={handleSave}
          submitText={editingRecipe ? 'Save Changes' : 'Add Recipe'}
          submitDisabled={!title.trim()}
        />
      }
    >
      {!editingRecipe && (
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

      {thumbnail && (
        <div className="form-thumbnail-preview">
          <img src={thumbnail} alt="thumbnail" />
          <button className="thumb-remove-btn" onClick={() => setThumbnail('')}>
            <IoClose size={14} />
          </button>
        </div>
      )}

      <FormGroup label="Title *">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Recipe name"
          autoFocus={!!editingRecipe}
        />
      </FormGroup>

      <FormGroup label="Description (optional)">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of the dish..."
          rows={2}
        />
      </FormGroup>

      <div className="form-time-row">
        <FormGroup label="Prep (min)">
          <input
            type="number"
            min="0"
            value={prepTime}
            onChange={e => setPrepTime(e.target.value)}
            placeholder="0"
          />
        </FormGroup>
        <FormGroup label="Cook (min)">
          <input
            type="number"
            min="0"
            value={cookTime}
            onChange={e => setCookTime(e.target.value)}
            placeholder="0"
          />
        </FormGroup>
        <FormGroup label="Servings">
          <input
            type="number"
            min="1"
            value={servings}
            onChange={e => setServings(e.target.value)}
            placeholder="2"
          />
        </FormGroup>
      </div>

      <FormGroup label="Ingredients">
        <div className="ingredient-list">
          {ingredients.map((ing, i) => (
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

      <FormGroup label="Instructions">
        <div className="instruction-list">
          {instructions.map((step, i) => (
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

      <FormGroup label="Tags (optional)">
        <div className="tags-input-row">
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="e.g. Italian, pasta, quick…"
          />
          <button className="add-tag-btn" onClick={addTag} disabled={!tagInput.trim()}>
            <IoAdd size={16} />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="tags-list">
            {tags.map(tag => (
              <span key={tag} className="tag-chip">
                {tag}
                <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}>
                  <IoClose size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </FormGroup>

      <FormGroup label="Source URL (optional)">
        <input
          type="url"
          value={sourceUrl}
          onChange={e => { setSourceUrl(e.target.value); setUrlDuplicateError(''); }}
          placeholder="https://…"
        />
        {urlDuplicateError && (
          <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '4px' }}>{urlDuplicateError}</p>
        )}
      </FormGroup>

      <label className="favorite-toggle">
        <input
          type="checkbox"
          checked={isFavorite}
          onChange={e => setIsFavorite(e.target.checked)}
        />
        <span>Mark as favorite</span>
        <IoHeart size={15} color={isFavorite ? '#EF4444' : '#94A3B8'} />
      </label>
    </Modal>
  );
}
