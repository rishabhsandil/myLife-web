import {
  IoTrash, IoHeart, IoHeartOutline, IoTime, IoPeople,
  IoPencil, IoLink, IoLogoYoutube,
  IoShareSocialOutline, IoPersonOutline, IoDownloadOutline,
} from '../../utils/icons';
import { Recipe, SharedRecipe } from '../../types';
import { Modal } from '../../components';
import { formatTime } from './recipeHelpers';

interface RecipeViewModalProps {
  isOpen: boolean;
  recipe: Recipe | SharedRecipe | null;
  onClose: () => void;
  onToggleFavorite: (recipe: Recipe) => void;
  onShare: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe | SharedRecipe) => void;
  onSaveToOwn: (recipe: SharedRecipe) => void;
}

export function RecipeViewModal({
  isOpen, recipe, onClose,
  onToggleFavorite, onShare, onEdit, onDelete, onSaveToOwn,
}: RecipeViewModalProps) {
  if (!recipe) return null;
  const isShared = 'sharedByName' in recipe;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="recipe-view">
        {recipe.thumbnail && (
          <div className="recipe-view-thumbnail">
            <img src={recipe.thumbnail} alt={recipe.title} />
          </div>
        )}

        <div className="recipe-view-header">
          <h2 className="recipe-view-title">{recipe.title}</h2>
          <div className="recipe-view-actions">
            {isShared ? (
              <>
                <button
                  className="recipe-view-btn"
                  onClick={() => { onSaveToOwn(recipe as SharedRecipe); onClose(); }}
                  title="Save to my recipes"
                >
                  <IoDownloadOutline size={20} />
                </button>
                <button
                  className="recipe-view-btn danger"
                  onClick={() => { onClose(); onDelete(recipe); }}
                  title="Remove"
                >
                  <IoTrash size={20} />
                </button>
              </>
            ) : (
              <>
                <button
                  className="recipe-view-btn"
                  onClick={() => onToggleFavorite(recipe as Recipe)}
                  title={recipe.isFavorite ? 'Remove favorite' : 'Add to favorites'}
                >
                  {recipe.isFavorite
                    ? <IoHeart size={22} color="#EF4444" />
                    : <IoHeartOutline size={22} />
                  }
                </button>
                <button
                  className="recipe-view-btn"
                  onClick={() => onShare(recipe as Recipe)}
                  title="Share recipe"
                >
                  <IoShareSocialOutline size={20} />
                </button>
                <button
                  className="recipe-view-btn"
                  onClick={() => { onClose(); onEdit(recipe as Recipe); }}
                  title="Edit"
                >
                  <IoPencil size={20} />
                </button>
                <button
                  className="recipe-view-btn danger"
                  onClick={() => { onClose(); onDelete(recipe); }}
                  title="Delete"
                >
                  <IoTrash size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {isShared && (
          <p className="recipe-view-shared-by">
            <IoPersonOutline size={14} />
            Shared by {(recipe as SharedRecipe).sharedByName}
          </p>
        )}

        {recipe.channelName && (
          <p className="recipe-view-channel">
            {recipe.sourcePlatform === 'youtube' && <IoLogoYoutube size={14} color="#FF0000" />}
            {recipe.channelName}
          </p>
        )}

        <div className="recipe-view-meta">
          {(recipe.prepTime ?? 0) > 0 && (
            <div className="recipe-meta-chip">
              <IoTime size={14} />
              <span>Prep: {formatTime(recipe.prepTime!)}</span>
            </div>
          )}
          {(recipe.cookTime ?? 0) > 0 && (
            <div className="recipe-meta-chip">
              <IoTime size={14} />
              <span>Cook: {formatTime(recipe.cookTime!)}</span>
            </div>
          )}
          {(recipe.servings ?? 0) > 0 && (
            <div className="recipe-meta-chip">
              <IoPeople size={14} />
              <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {recipe.description && (
          <p className="recipe-view-description">{recipe.description}</p>
        )}

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="recipe-view-tags">
            {recipe.tags.map(tag => (
              <span key={tag} className="recipe-tag">{tag}</span>
            ))}
          </div>
        )}

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="recipe-view-section">
            <h3 className="recipe-section-title">
              Ingredients ({recipe.ingredients.length})
            </h3>
            <ul className="recipe-ingredients-list">
              {recipe.ingredients.map((ing, i) => (
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

        {recipe.instructions && recipe.instructions.length > 0 && (
          <div className="recipe-view-section">
            <h3 className="recipe-section-title">
              Instructions ({recipe.instructions.length} steps)
            </h3>
            <ol className="recipe-instructions-list">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="recipe-instruction-item">
                  <span className="instruction-number">{i + 1}</span>
                  <span className="instruction-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
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
  );
}
