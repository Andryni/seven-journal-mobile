import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

/**
 * Root bottom tab navigator param list.
 * Each screen takes no params (all data is fetched via hooks).
 */
export type RootTabParamList = {
  Dashboard: undefined;
  Trades: undefined;
  Calendar: undefined;
  Analytics: undefined;
  /** Conversation with the journal, backed by the chat Edge Function. */
  Chat: undefined;
  /** Playbook, Accounts and Settings live behind this tab. */
  More: undefined;
};

/** Screen props for each tab — usable in screen components via `useNavigation<...>()` */
export type DashboardScreenProps = BottomTabScreenProps<RootTabParamList, 'Dashboard'>;
export type TradesScreenProps = BottomTabScreenProps<RootTabParamList, 'Trades'>;
export type CalendarScreenProps = BottomTabScreenProps<RootTabParamList, 'Calendar'>;
export type AnalyticsScreenProps = BottomTabScreenProps<RootTabParamList, 'Analytics'>;
export type MoreScreenProps = BottomTabScreenProps<RootTabParamList, 'More'>;
