import { useModal } from '../../hooks';
import { Recipe } from '../../types';

/**
 * Aggregates the four sibling `useModal<Recipe>()` instances RecipePage needs:
 * add/edit, view, delete-confirm, and share. Use the returned object the same
 * way you'd use a single `useModal` result, e.g. `modals.add.open(recipe)`.
 */
export function useRecipeModals() {
  const add = useModal<Recipe>();
  const view = useModal<Recipe>();
  const del = useModal<Recipe>();
  const share = useModal<Recipe>();
  return { add, view, del, share };
}
