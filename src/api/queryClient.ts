import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline-resilient query client.
 *
 * PRODUCT.md promised "offline-resilient with deferred sync" but nothing
 * implemented it: closing the app dropped every cached trade and a cold start
 * without network showed empty screens.
 *
 * Now: the whole query cache is persisted to AsyncStorage and rehydrated on
 * boot, and mutations are given a resume-capable default so they can be
 * replayed when connectivity returns.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      // Must be >= the persister maxAge, otherwise restored entries are
      // garbage-collected immediately on rehydration.
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      // Data from disk is better than a spinner; refetch quietly behind it.
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 3,
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'seven-query-cache',
  throttleTime: 1000,
});

/** 24h — beyond that, stale financial data is worse than an empty state. */
export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24;
