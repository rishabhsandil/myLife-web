import { useState, useCallback } from 'react';

interface UseListOptions<T> {
  fetchFn: () => Promise<T[]>;
  createFn: (item: T) => Promise<void>;
  updateFn: (item: T) => Promise<void>;
  deleteFn: (id: string) => Promise<void>;
  getId: (item: T) => string;
}

interface UseListResult<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (item: T) => Promise<void>;
  update: (item: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useList<T>({
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  getId,
}: UseListOptions<T>): UseListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFn();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  const add = useCallback(async (item: T) => {
    try {
      await createFn(item);
      setItems(prev => [...prev, item]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    }
  }, [createFn]);

  const update = useCallback(async (item: T) => {
    try {
      await updateFn(item);
      setItems(prev => prev.map(i => getId(i) === getId(item) ? item : i));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }, [updateFn, getId]);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteFn(id);
      setItems(prev => prev.filter(i => getId(i) !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [deleteFn, getId]);

  return { items, setItems, isLoading, error, load, add, update, remove };
}
