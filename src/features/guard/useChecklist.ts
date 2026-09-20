import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import {
  localDayKey,
  preFlightRequired,
  preFlightSatisfied,
  type PreFlightFacts,
} from './preFlight';

/**
 * The pre-flight: the trader's own items, and whether they were ticked today.
 *
 * `user_checklists` has been in the schema since the beginning with no reader
 * at all — the comment on the table pointed at a hook that was never written,
 * so the table was dead weight and the discipline it was meant to carry simply
 * did not exist. It backs the pre-flight now.
 *
 * Everything here tolerates a database that has not run the latest schema: a
 * missing table or column yields empty data, never an error on screen. The
 * pre-flight is a discipline aid, and a discipline aid that breaks the entry
 * form on an older database would be worse than the missing feature.
 */

export interface ChecklistItem {
  id: string;
  text: string;
  sort_order: number;
}

export function useChecklist() {
  const client = useQueryClient();
  const day = localDayKey();

  const itemsQuery = useQuery<ChecklistItem[]>({
    queryKey: ['user_checklists'],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_checklists')
        .select('id, text, sort_order')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data as ChecklistItem[];
    },
  });

  const completionQuery = useQuery<string | null>({
    // Keyed by day: a completion is only meaningful for the session it was
    // made for, and the cache must not carry yesterday's tick into today.
    queryKey: ['checklist_completion', day],
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_completions')
        .select('date')
        .eq('date', day)
        .maybeSingle();

      if (error || !data) return null;
      return (data.date as string) ?? null;
    },
  });

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['user_checklists'] });
    client.invalidateQueries({ queryKey: ['checklist_completion'] });
  };

  const addItems = useMutation({
    mutationFn: async (labels: string[]) => {
      const rows = labels.map((text, index) => ({
        text,
        sort_order: (itemsQuery.data?.length ?? 0) + index,
      }));
      const { error } = await supabase.from('user_checklists').insert(rows);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_checklists').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: async (ticked: string[]) => {
      const { error } = await supabase.rpc('complete_preflight', {
        p_date: day,
        p_items: ticked,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return {
    items: itemsQuery.data ?? [],
    isLoading: itemsQuery.isLoading,
    /** The local day key the completion is stored under, or null. */
    completedOn: completionQuery.data ?? null,
    today: day,
    addItems: addItems.mutateAsync,
    removeItem: removeItem.mutateAsync,
    complete: complete.mutateAsync,
    isSaving: addItems.isPending || removeItem.isPending || complete.isPending,
  };
}

/**
 * The pre-flight as the entry forms need it: what is required, what has been
 * ticked, and whether the save may go through.
 *
 * The ticked state lives HERE, not in each form: two forms ask the same
 * question, and a gate whose answer depends on which screen you opened is not
 * a gate.
 */
export function usePreFlight() {
  const checklist = useChecklist();
  const [ticked, setTicked] = useState<string[]>([]);

  const facts: PreFlightFacts = {
    itemCount: checklist.items.length,
    completedOn: checklist.completedOn,
    tradeDay: checklist.today,
  };
  const required = preFlightRequired(facts);

  const toggle = useCallback((id: string) => {
    setTicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const allTicked =
    checklist.items.length > 0 && checklist.items.every(i => ticked.includes(i.id));

  const complete = useCallback(async () => {
    await checklist.complete(checklist.items.map(i => i.text));
    // Cleared once recorded: the next stale tick would otherwise re-satisfy a
    // gate it no longer describes.
    setTicked([]);
  }, [checklist]);

  return {
    ...checklist,
    required,
    ticked,
    toggle,
    allTicked,
    canProceed: preFlightSatisfied(required, allTicked),
    complete,
  };
}
