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
  Playbook: undefined;
  Accounts: undefined;
};

/** Screen props for each tab — usable in screen components via `useNavigation<...>()` */
export type DashboardScreenProps = BottomTabScreenProps<RootTabParamList, 'Dashboard'>;
export type TradesScreenProps = BottomTabScreenProps<RootTabParamList, 'Trades'>;
export type CalendarScreenProps = BottomTabScreenProps<RootTabParamList, 'Calendar'>;
export type AnalyticsScreenProps = BottomTabScreenProps<RootTabParamList, 'Analytics'>;
export type PlaybookScreenProps = BottomTabScreenProps<RootTabParamList, 'Playbook'>;
export type AccountsScreenProps = BottomTabScreenProps<RootTabParamList, 'Accounts'>;
