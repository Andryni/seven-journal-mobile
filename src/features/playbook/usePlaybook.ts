import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyDebrief {
  id: string;
  user_id: string;
  date: string;
  market_sentiment: string | null;
  lessons_learned: string | null;
  mistakes_committed: string[];
  mental_score: number | null;
  htf_analysis: string | null;
  htf_image_url: string | null;
  rules_followed: string[];
  objective_tomorrow: string | null;
  emotion_before: string | null;
  day_rating: number | null;
  created_at: string;
  updated_at: string;
}

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

export type DebriefPayload = Omit<DailyDebrief, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string };
export type SetupPayload = Omit<PlaybookSetup, 'id' | 'user_id' | 'created_at'> & { id?: string };

export function usePlaybook() {
  const queryClient = useQueryClient();

  const { data: debriefs = [], isLoading } = useQuery<DailyDebrief[]>({
    queryKey: ['daily_debriefs'],
    queryFn: async () => {
      let dbDebriefs: DailyDebrief[] = [];
      try {
        const { data, error } = await supabase
          .from('daily_debriefs')
          .select('*')
          .order('date', { ascending: false });

        if (!error && data) {
          dbDebriefs = data;
        }
      } catch {}

      let localDebriefs: DailyDebrief[] = [];
      try {
        const localStr = await AsyncStorage.getItem('seven_daily_debriefs');
        localDebriefs = localStr ? JSON.parse(localStr) : [];
      } catch {}

      const ids = new Set(dbDebriefs.map(d => d.id));
      const merged = [...dbDebriefs];
      for (const d of localDebriefs) {
        if (!ids.has(d.id)) merged.push(d);
      }
      return merged;
    },
  });

  const { mutateAsync: saveDebrief, isPending: isSaving } = useMutation({
    mutationFn: async (payload: DebriefPayload) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || 'anon';

      const debriefData = {
        ...payload,
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      try {
        if (payload.id) {
          const { data, error } = await supabase
            .from('daily_debriefs')
            .update(debriefData)
            .eq('id', payload.id)
            .select()
            .single();
          if (!error && data) return data;
        } else {
          const { data, error } = await supabase
            .from('daily_debriefs')
            .insert({ ...debriefData, created_at: new Date().toISOString() })
            .select()
            .single();
          if (!error && data) return data;
        }
      } catch {}

      // Fallback local storage
      const existing = debriefs.filter(d => (payload.id ? d.id !== payload.id : d.date !== payload.date));
      const newEntry: DailyDebrief = {
        id: payload.id || `local_${Date.now()}`,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload,
      };
      const updated = [newEntry, ...existing];
      await AsyncStorage.setItem('seven_daily_debriefs', JSON.stringify(updated));
      return newEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_debriefs'] });
    },
  });

  const { mutateAsync: deleteDebrief } = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from('daily_debriefs').delete().eq('id', id);
      } catch {}

      const localStr = await AsyncStorage.getItem('seven_daily_debriefs');
      const list: DailyDebrief[] = localStr ? JSON.parse(localStr) : [];
      const updated = list.filter(d => d.id !== id);
      await AsyncStorage.setItem('seven_daily_debriefs', JSON.stringify(updated));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_debriefs'] });
    },
  });

  return { debriefs, isLoading, saveDebrief, isSaving, deleteDebrief };
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

        if (!error && data) dbSetups = data;
      } catch {}

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

  const { mutateAsync: saveSetup } = useMutation({
    mutationFn: async (payload: SetupPayload) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || 'anon';

      const setupData = {
        ...payload,
        user_id: userId,
      };

      try {
        if (payload.id) {
          const { data, error } = await supabase
            .from('playbook_setups')
            .update(setupData)
            .eq('id', payload.id)
            .select()
            .single();
          if (!error && data) return data;
        } else {
          const { data, error } = await supabase
            .from('playbook_setups')
            .insert({ ...setupData, created_at: new Date().toISOString() })
            .select()
            .single();
          if (!error && data) return data;
        }
      } catch {}

      const existing = setups.filter(s => s.id !== payload.id);
      const newEntry: PlaybookSetup = {
        id: payload.id || `local_setup_${Date.now()}`,
        user_id: userId,
        created_at: new Date().toISOString(),
        ...payload,
      };
      const updated = [newEntry, ...existing];
      await AsyncStorage.setItem('seven_playbook_setups', JSON.stringify(updated));
      return newEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook_setups'] });
    },
  });

  const { mutateAsync: deleteSetup } = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from('playbook_setups').delete().eq('id', id);
      } catch {}

      const localStr = await AsyncStorage.getItem('seven_playbook_setups');
      const list: PlaybookSetup[] = localStr ? JSON.parse(localStr) : [];
      const updated = list.filter(s => s.id !== id);
      await AsyncStorage.setItem('seven_playbook_setups', JSON.stringify(updated));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook_setups'] });
    },
  });

  return { setups, isLoading, saveSetup, deleteSetup };
}
