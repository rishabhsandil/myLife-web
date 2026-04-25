import {
  IoTrash, IoRestaurantOutline, IoTime, IoPeople, IoLogoYoutube,
  IoPersonOutline, IoDownloadOutline,
} from '../../utils/icons';
import { SharedRecipe } from '../../types';
import { formatTime } from './recipeHelpers';

interface SharedRecipeCardProps {
  recipe: SharedRecipe;
  onView: () => void;
  onSaveToOwn: () => void;
  onDelete: () => void;
}

export function SharedRecipeCard({ recipe, onView, onSaveToOwn, onDelete }: SharedRecipeCardProps) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div className="recipe-card-wrapper">
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div className="recipe-card shared-recipe-card">
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

        <div className="recipe-card-body" onClick={onView}>
          <h3 className="recipe-card-title">{recipe.title}</h3>
          <p className="shared-by-label">
            <IoPersonOutline size={11} /> From {recipe.sharedByName}
          </p>
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
          </div>
        </div>

        <div className="recipe-card-actions">
          <button
            className="recipe-action-btn"
            onClick={e => { e.stopPropagation(); onSaveToOwn(); }}
            title="Save to my recipes"
          >
            <IoDownloadOutline size={17} />
          </button>
          <button
            className="recipe-action-btn"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Remove"
          >
            <IoTrash size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
