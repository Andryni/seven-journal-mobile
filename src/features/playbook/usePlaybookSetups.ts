import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PlaybookSetup {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  timeframes: string[];
  validation_rules: string[];
  tags: string[];
  image_url: string | null;
  created_at: string;
}

export function usePlaybookSetups() {
  const queryClient = useQueryClient();

  const { data: setups = [], isLoading } = useQuery<PlaybookSetup[]>({
    queryKey: ['playbook_setups'],
    queryFn: async () => {
      let dbSetups: PlaybookSetup[] = [];
      try {
        const { data, error } = await supabase
          .from('playbook_setups')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          dbSetups = data;
        }
      } catch {
        // Table not created or network issue
      }

      let localSetups: PlaybookSetup[] = [];
      try {
        const localStr = await AsyncStorage.getItem('seven_playbook_setups');
        localSetups = localStr ? JSON.parse(localStr) : [];
      } catch {}

      const ids = new Set(dbSetups.map(s => s.id));
      const merged = [...dbSetups];
      for (const s of localSetups) {
        if (!ids.has(s.id)) merged.push(s);
      }
      return merged;
    },
  });

  return { setups, isLoading };
}
