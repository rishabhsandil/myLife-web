import {
  IoHeart, IoHeartOutline, IoRestaurantOutline, IoTime, IoPeople,
  IoPencil, IoLogoYoutube,
} from '../../utils/icons';
import { Recipe } from '../../types';
import { SortableSwipeItem } from '../../components';
import { formatTime } from './recipeHelpers';

interface RecipeCardProps {
  recipe: Recipe;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function RecipeCard({ recipe, onView, onEdit, onDelete, onToggleFavorite }: RecipeCardProps) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <SortableSwipeItem
      onSwipeDelete={onDelete}
      wrapperClassName="recipe-card-wrapper"
      contentClassName="recipe-card"
    >
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
