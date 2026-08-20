import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';

export interface ChecklistItem {
  id: string;
  user_id?: string;
  text: string;
  is_done: boolean;
  sort_order: number;
  created_at?: string;
}



export function useChecklist() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<ChecklistItem[]>({
    queryKey: ['user_checklists'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_checklists')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Checklist table error or not created yet:', error.message);
        return [];
      }

      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from('user_checklists')
        .update({ is_done })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_done }) => {
      await queryClient.cancelQueries({ queryKey: ['user_checklists'] });
      const prev = queryClient.getQueryData<ChecklistItem[]>(['user_checklists']);
      queryClient.setQueryData<ChecklistItem[]>(['user_checklists'], old =>
        old ? old.map(item => (item.id === id ? { ...item, is_done } : item)) : []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['user_checklists'], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['user_checklists'] }),
  });

  const addItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('user_checklists')
        .insert([{
          user_id: user.id,
          text: text.trim(),
          is_done: false,
          sort_order: (items.length || 0) + 1,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_checklists'] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_checklists')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['user_checklists'] });
      const prev = queryClient.getQueryData<ChecklistItem[]>(['user_checklists']);
      queryClient.setQueryData<ChecklistItem[]>(['user_checklists'], old =>
        old ? old.filter(item => item.id !== id) : []
      );
      return { prev };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['user_checklists'] }),
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_checklists')
        .update({ is_done: false })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['user_checklists'] });
      const prev = queryClient.getQueryData<ChecklistItem[]>(['user_checklists']);
      queryClient.setQueryData<ChecklistItem[]>(['user_checklists'], old =>
        old ? old.map(item => ({ ...item, is_done: false })) : []
      );
      return { prev };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['user_checklists'] }),
  });

  return {
    items,
    isLoading,
    toggleItem: (id: string, is_done: boolean) => toggleMutation.mutate({ id, is_done }),
    addItem: (text: string) => addItemMutation.mutate(text),
    deleteItem: (id: string) => deleteItemMutation.mutate(id),
    resetAll: () => resetAllMutation.mutate(),
  };
}
