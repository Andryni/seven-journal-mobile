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

type DebriefPayload = Omit<DailyDebrief, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  id?: string;
};
type SetupPayload = Omit<PlaybookSetup, 'id' | 'user_id' | 'created_at'> & { id?: string };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Playbook persistence.
 *
 * Previously every read merged Supabase with AsyncStorage and every write
 * fell back to AsyncStorage inside `catch {}`. Consequences:
 *   - setups and debriefs never synced across devices
 *   - everything was lost on reinstall
 *   - a failing insert looked identical to a successful one, so the user was
 *     never told their data had not left the phone
 *
 * Supabase is now the single source of truth (offline is handled globally by
 * the persisted query cache + mutation retries). Legacy local records are
 * migrated once, then the local keys are dropped.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const LEGACY_DEBRIEFS_KEY = 'seven_daily_debriefs';
const LEGACY_SETUPS_KEY = 'seven_playbook_setups';

const isLegacyId = (id: string) => id.startsWith('local_');

/** One-shot import of pre-Supabase records. Safe to call repeatedly. */
async function migrateLegacy<T extends { id: string }>(
  key: string,
  table: 'daily_debriefs' | 'playbook_setups',
  userId: string,
  strip: (row: T) => Record<string, unknown>
): Promise<void> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return;

  try {
    const rows: T[] = JSON.parse(raw);
    const pending = rows.filter(r => isLegacyId(r.id));

    if (pending.length > 0) {
      // Let Postgres assign real UUIDs; legacy ids were timestamps.
      const payload = pending.map(r => ({ ...strip(r), user_id: userId }));
      const { error } = await supabase.from(table).insert(payload);
      // Keep the local copy if the import failed, so nothing is lost.
      if (error) return;
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // Corrupt local JSON: drop it rather than blocking the app forever.
    await AsyncStorage.removeItem(key);
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export function usePlaybook() {
  const queryClient = useQueryClient();

  const { data: debriefs = [], isLoading } = useQuery<DailyDebrief[]>({
    queryKey: ['daily_debriefs'],
    queryFn: async () => {
      const userId = await currentUserId();
      if (!userId) return [];

      await migrateLegacy<DailyDebrief>(
        LEGACY_DEBRIEFS_KEY,
        'daily_debriefs',
        userId,
        ({ id, user_id, created_at, updated_at, ...rest }) => rest
      );

      const { data, error } = await supabase
        .from('daily_debriefs')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const { mutateAsync: saveDebrief, isPending: isSaving } = useMutation({
    mutationFn: async (payload: DebriefPayload) => {
      const userId = await currentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { id, ...fields } = payload;
      const row = { ...fields, user_id: userId, updated_at: new Date().toISOString() };

      // One debrief per day: upsert on the natural key instead of branching.
      const { data, error } = id
        ? await supabase.from('daily_debriefs').update(row).eq('id', id).select().single()
        : await supabase
            .from('daily_debriefs')
            .upsert(row, { onConflict: 'user_id,date' })
            .select()
            .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_debriefs'] });
    },
  });

  const { mutateAsync: deleteDebrief } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_debriefs').delete().eq('id', id);
      if (error) throw error;
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
      const userId = await currentUserId();
      if (!userId) return [];

      await migrateLegacy<PlaybookSetup>(
        LEGACY_SETUPS_KEY,
        'playbook_setups',
        userId,
        ({ id, user_id, created_at, ...rest }) => rest
      );

      const { data, error } = await supabase
        .from('playbook_setups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const { mutateAsync: saveSetup } = useMutation({
    mutationFn: async (payload: SetupPayload) => {
      const userId = await currentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { id, ...fields } = payload;
      const row = { ...fields, user_id: userId };

      const { data, error } = id
        ? await supabase.from('playbook_setups').update(row).eq('id', id).select().single()
        : await supabase.from('playbook_setups').insert(row).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook_setups'] });
    },
  });

  const { mutateAsync: deleteSetup } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('playbook_setups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook_setups'] });
    },
  });

  return { setups, isLoading, saveSetup, deleteSetup };
}
