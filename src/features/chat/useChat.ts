import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../api/supabaseClient';
import { buildChatContext, contextWindow } from './buildChatContext';
import { parseAction, resolveAction, patchFor, type ResolvedAction } from './chatActions';
import { useTrades } from '../trades/useTrades';
import type { Trade, TradingAccount } from '../../types/domain';

/**
 * Conversation state for the AI chat.
 *
 * HISTORY IS KEPT, but only the last few turns and only on the device.
 *
 * Discarding it on every open would make the chat useless: "and on Fridays?"
 * has no meaning without the previous question. Keeping everything forever
 * would instead grow the payload without bound and quietly re-send months of
 * conversation to the model on every message.
 *
 * So: the last MAX_TURNS exchanges are persisted to AsyncStorage (local, not
 * Supabase -- the journal is the record, a chat log is not), and the same
 * window is what travels upstream. `clear` wipes it.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  at: number;
  /**
   * A change the coach proposes, attached to the message that describes it.
   *
   * Never applied automatically: the UI renders a confirmation and the user
   * decides. Held on the message rather than in hook state so an older
   * proposal stays visible and inert once the conversation has moved on --
   * a stale button that still worked would be a trap.
   */
  action?: ResolvedAction | null;
  /** Set once confirmed, so the button becomes a record rather than a control. */
  actionApplied?: boolean;
}

export type ChatError =
  | 'not_configured'
  | 'not_deployed'
  | 'model_not_found'
  | 'unauthorized'
  | 'rate_limited'
  | 'network'
  | 'unknown';

/** Exchanges retained. Twelve turns is roughly six questions and answers. */
const MAX_TURNS = 12;
const STORAGE_KEY = 'seven-chat-history-v1';

export function useChat(params: {
  trades: Trade[];
  account?: TradingAccount | null;
  locale?: string;
  focusTradeId?: string | null;
  /** Live state of the rule engine, so the model can answer "can I trade". */
  isLocked?: boolean;
}) {
  const { trades, account = null, locale = 'fr', focusTradeId = null, isLocked = false } = params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { updateTrade } = useTrades();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Restore on mount.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_TURNS));
      })
      .catch(() => {
        // A corrupt log is not worth surfacing: start fresh.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist, but only after the initial read so an empty state cannot
  // overwrite a stored conversation during the first frame.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_TURNS))).catch(() => {});
  }, [messages, hydrated]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: `u${Date.now()}`,
        role: 'user',
        text: trimmed,
        at: Date.now(),
      };

      // The turns sent upstream exclude the message being sent, which the
      // function appends itself.
      const history = [...messages].slice(-MAX_TURNS).map(m => ({ role: m.role, text: m.text }));

      setMessages(prev => [...prev, userMsg]);
      setLoading(true);
      setError(null);
      setDetail(null);

      try {
        const context = buildChatContext({ trades, account, locale, focusTradeId, isLocked });
        // The same ordered list the model sees as "trades", used below to
        // resolve any action it proposes against real trade ids.
        const sentWindow = contextWindow(trades, focusTradeId);
        const { data, error: fnError } = await supabase.functions.invoke('chat', {
          body: { context, history, message: trimmed },
        });

        if (fnError) {
          const ctx = (fnError as { context?: Response }).context;
          let code: string | null = null;
          if (ctx) {
            try {
              const b = await ctx.clone().json();
              if (typeof b?.error === 'string') code = b.error;
              if (typeof b?.upstreamReason === 'string' && b.upstreamReason) {
                setDetail(b.upstreamReason);
              }
              if (b?.error === 'model_not_found') setDetail(String(b.model ?? ''));
            } catch {
              // Non-JSON body; fall through to the status code.
            }
          }
          if (code === 'rate_limited' || ctx?.status === 429) setError('rate_limited');
          else if (code === 'not_configured' || ctx?.status === 503) setError('not_configured');
          else if (code === 'model_not_found') setError('model_not_found');
          else if (ctx?.status === 401 || ctx?.status === 403) setError('unauthorized');
          else if (ctx?.status === 404) setError('not_deployed');
          else if (ctx) setError('unknown');
          else setError('network');
          return;
        }

        if (data?.error) {
          setError(data.error === 'rate_limited' ? 'rate_limited' : 'unknown');
          return;
        }
        if (!data?.reply) {
          setError('unknown');
          return;
        }

        if (!mounted.current) return;
        setMessages(prev => [
          ...prev,
          {
            id: `m${Date.now()}`,
            role: 'model',
            text: String(data.reply),
            at: Date.now(),
            /**
             * Resolved against the exact window that was sent, so a
             * hallucinated trade number resolves to nothing rather than
             * landing on a real row.
             */
            action: (() => {
              const parsed = parseAction(data.action);
              if (!parsed) return null;
              const resolved = resolveAction(parsed, sentWindow);
              return resolved.ok ? resolved.action : null;
            })(),
          },
        ]);
      } catch (err) {
        console.warn('chat failed', err);
        setError('network');
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [messages, loading, trades, account, locale, focusTradeId, isLocked]
  );

  /**
   * Apply a proposal the user confirmed.
   *
   * The only place in the app where the coach causes a write, and it runs
   * from a press rather than from a model response. Trades already carrying
   * the value are skipped by patchFor, so confirming twice is a no-op rather
   * than a second round of identical updates.
   */
  const applyAction = useCallback(
    async (messageId: string) => {
      const message = messages.find(m => m.id === messageId);
      const action = message?.action;
      if (!action || message?.actionApplied) return;

      try {
        for (const trade of action.trades) {
          const patch = patchFor(action, trade);
          if (!patch) continue;
          await updateTrade({ id: trade.id, ...patch });
        }
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, actionApplied: true } : m))
        );
      } catch (err) {
        // A failed write must not be recorded as applied: the button stays
        // available so the trader can retry.
        console.warn('chat action failed', err);
        setError('unknown');
      }
    },
    [messages, updateTrade]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setDetail(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return { messages, loading, error, detail, send, clear, applyAction, hydrated };
}
