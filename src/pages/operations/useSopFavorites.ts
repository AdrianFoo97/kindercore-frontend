import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchFavorites, setFavorite } from '../../api/sop-favorites.js';
import { useToast } from '../../components/common/Toast.js';
import { toggleFavorite } from './sopFavorites.js';

const KEY = ['sop-favorites'];

/** My favourite guides — starring updates at once and undoes itself if saving fails. */
export function useSopFavorites() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { data: ids = [], isLoading } = useQuery({ queryKey: KEY, queryFn: fetchFavorites });
  const toggle = async (id: string, on: boolean) => {
    const before = qc.getQueryData<string[]>(KEY) ?? [];
    qc.setQueryData(KEY, toggleFavorite(before, id, on));
    try {
      await setFavorite(id, on);
    } catch (e: any) {
      qc.setQueryData(KEY, before);
      showToast(e?.message ?? 'Couldn’t update your favourites', 'error');
    }
  };
  return { ids, isLoading, isFavorite: (id: string) => ids.includes(id), toggle };
}