import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TradingGoals {
  weeklyPnlTarget: number;       // e.g. 500
  winRateTarget: number;         // e.g. 60 (%)
  maxDrawdownValue: number;      // e.g. 500 ($) or 5 (%)
  maxDrawdownUnit: '$' | '%';    // unit for drawdown
  dailyTradeCount: number;        // e.g. 3
  riskPerTrade: number;           // e.g. 0.5 (%)
}

const STORAGE_KEY = 'seven_trading_goals';

const DEFAULT_GOALS: TradingGoals = {
  weeklyPnlTarget: 500,
  winRateTarget: 60,
  maxDrawdownValue: 5,
  maxDrawdownUnit: '%',
  dailyTradeCount: 3,
  riskPerTrade: 1,
};

export function useTradingGoals() {
  const [goals, setGoals] = useState<TradingGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          setGoals({ ...DEFAULT_GOALS, ...JSON.parse(raw) });
        } catch { /* keep defaults */ }
      }
      setLoading(false);
    });
  }, []);

  const updateGoals = useCallback(async (patch: Partial<TradingGoals>) => {
    const next = { ...goals, ...patch };
    setGoals(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [goals]);

  const resetGoals = useCallback(async () => {
    setGoals(DEFAULT_GOALS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GOALS));
  }, []);

  return { goals, loading, updateGoals, resetGoals };
}
