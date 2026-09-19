import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../api/supabaseClient';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';
import { buildChatContext, contextWindow } from './buildChatContext';
import { parseAction, resolveAction, patchFor, type ResolvedAction } from './chatActions';
import { useTrades } from '../trades/useTrades';
import { useBrokerCostMap } from '../sync/useBrokerCosts';
import { useEconomicCalendar } from '../calendar/useEconomicCalendar';
import { useFillHistory } from '../trades/useFillHistory';
import type { FillKind, FillSource } from '../trades/fillHistory';
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

  /**
   * Broker-recorded costs, read once for the whole trade list. Only an
   * auto-fed account can have staging rows; on a manual journal the map
   * comes back empty and every costs-fill path honestly says "not
   * available". Enables both the `costsFillable` flag in the gaps block
   * and the device-side resolution of `set_costs` proposals.
   */
  const { costs: brokerCosts } = useBrokerCostMap(
    useMemo(() => trades.map(t => t.id), [trades])
  );
  // High-impact events, for the news-proximity behavioural detector. Same
  // cached query the dashboard band uses — no second fetch, ever.
  const { events: calendarEvents } = useEconomicCalendar();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { updateTrade } = useTrades();
  const { logWrites } = useFillHistory();
  const { showSuccess } = useToast();
  const { t } = useT();
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
        const context = buildChatContext({
          trades,
          account,
          locale,
          focusTradeId,
          isLocked,
          brokerCosts,
          events: calendarEvents,
        });
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
              /**
               * set_costs resolves against the broker map the DEVICE built
               * from the staging table; if the model named a trade without
               * broker data, the whole proposal is refused rather than               * half-filled.
               */
              const resolved = resolveAction(parsed, sentWindow, brokerCosts);
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
        const logged: Parameters<typeof logWrites>[0] = [];
        if (action.kind === 'request_broker_fill') {
          // Nothing is written into the journal here ON PURPOSE: the fill
          // arrives asynchronously from the broker's own rebuild and only
          // into EMPTY fields (apply_broker_refresh). The confirmation is a
          // request to the terminal; the toast says exactly that, and the
          // loop below (journal writes + audit log) is skipped entirely.
          const { error: rpcErr } = await supabase.rpc('request_broker_fill', {
            p_trade_ids: action.tradeIds,
          });
          if (rpcErr) throw rpcErr;
          showSuccess(t('chatActionBrokerRequested').replace('{n}', String(action.trades.length)));
          setMessages(prev =>
            prev.map(m => (m.id === messageId ? { ...m, actionApplied: true } : m))
          );
          return;
        }
        for (const trade of action.trades) {
          const patch = patchFor(action, trade);
          if (!patch) continue;
          await updateTrade({ id: trade.id, ...patch });
          /**
           * One history line per written field, mirroring the patch exactly:
           * the audit log must never claim a write that did not happen, nor
           * omit one that did. Values come from the patch itself, so the log
           * and the journal cannot drift.
           */
          if ('r_multiple' in patch && patch.r_multiple != null) {
            logged.push({ tradeId: trade.id, source: 'chat' as FillSource, kind: 'r_multiple' as FillKind, rMultiple: patch.r_multiple });
          }
          if ('commission' in patch) {
            logged.push({
              tradeId: trade.id,
              source: 'chat' as FillSource,
              kind: 'costs' as FillKind,
              commission: patch.commission ?? 0,
              swap: patch.swap ?? 0,
            });
          }
          if ('tags' in patch && action.kind === 'add_tag') {
            logged.push({ tradeId: trade.id, source: 'chat' as FillSource, kind: 'tag' as FillKind, detail: action.tag });
          }
          if ('mental_state' in patch && action.kind === 'set_mental_state') {
            logged.push({ tradeId: trade.id, source: 'chat' as FillSource, kind: 'mental_state' as FillKind, detail: action.mentalState });
          }
        }
        // Best-effort after the writes: a failed log must never roll back a
        // confirmed journal write (see useFillHistory).
        if (logged.length > 0) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) await logWrites(logged, user.id);
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
    [messages, updateTrade, logWrites]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setDetail(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return { messages, loading, error, detail, send, clear, applyAction, hydrated };
}
