import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BookMarked, Wallet, ChevronRight, Settings, CalendarRange } from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT } from '../i18n';
import { Panel, Hairline } from '../components/ui/Panel';
import { PressableScale } from '../components/ui/PressableScale';
import { duration, stagger } from '../theme/motion';
import { PlaybookScreen } from './PlaybookScreen';
import { AccountsScreen } from './AccountsScreen';
import { WeeklyReviewScreen } from './WeeklyReviewScreen';
import { SettingsSheet } from '../components/settings/SettingsSheet';
import { useAccounts } from '../features/accounts/useAccounts';
import { usePlaybookSetups } from '../features/playbook/usePlaybook';

type Route = 'menu' | 'playbook' | 'accounts' | 'weekly';

/**
 * "More" — collapses Playbook, Accounts and Settings behind one tab.
 *
 * The tab bar had six items; the platform guideline is five, and at six the
 * labels were squeezed to 9px. Dashboard / Trades / Calendar / Analytics are
 * the daily-use screens and keep their slots. Playbook and Accounts are
 * configuration-grade: visited weekly at most.
 *
 * Implemented as local routing rather than a nested navigator so the existing
 * screens keep working unchanged and the bundle gains no new dependency.
 */
export const MoreScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [route, setRoute] = useState<Route>('menu');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const navigation = useNavigation();

  // Reset to the menu whenever the tab loses focus. Without this the local
  // route survives the tab switch, so leaving on Playbook and coming back to
  // "More" later reopened Playbook instead of the list -- the menu looked
  // unreachable.
  useEffect(
    () => navigation.addListener('blur', () => setRoute('menu')),
    [navigation],
  );

  const { accounts } = useAccounts();
  const { setups } = usePlaybookSetups();

  if (route === 'playbook') {
    return <SubScreen title={t('tabPlaybook')} onBack={() => setRoute('menu')} theme={theme}>
      <PlaybookScreen />
    </SubScreen>;
  }

  if (route === 'accounts') {
    return <SubScreen title={t('tabAccounts')} onBack={() => setRoute('menu')} theme={theme}>
      <AccountsScreen />
    </SubScreen>;
  }

  if (route === 'weekly') {
    return <SubScreen title={t('weeklyReview')} onBack={() => setRoute('menu')} theme={theme}>
      <WeeklyReviewScreen />
    </SubScreen>;
  }

  const entries = [
    {
      id: 'weekly' as const,
      icon: <CalendarRange size={17} color={theme.colors.primary} strokeWidth={1.75} />,
      title: t('weeklyReview'),
      sub: t('moreWeeklySub'),
      count: null as number | null,
    },
    {
      id: 'playbook' as const,
      icon: <BookMarked size={17} color={theme.colors.primary} strokeWidth={1.75} />,
      title: t('tabPlaybook'),
      sub: t('morePlaybookSub'),
      count: setups.length,
    },
    {
      id: 'accounts' as const,
      icon: <Wallet size={17} color={theme.colors.primary} strokeWidth={1.75} />,
      title: t('tabAccounts'),
      sub: t('moreAccountsSub'),
      count: accounts.length,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>{t('tabMore')}</Text>

      <Panel flush>
        {entries.map((e, i) => (
          <Animated.View key={e.id} entering={FadeIn.delay(stagger(i)).duration(duration.fast)}>
            <PressableScale
              style={styles.row}
              onPress={() => setRoute(e.id)}
              accessibilityLabel={e.title}
            >
              <View style={styles.rowIcon}>{e.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{e.title}</Text>
                <Text style={styles.rowSub}>{e.sub}</Text>
              </View>
              {e.count !== null ? <Text style={styles.rowCount}>{e.count}</Text> : null}
              <ChevronRight size={15} color={theme.colors.textDark} strokeWidth={2} />
            </PressableScale>
            {i < entries.length - 1 ? <Hairline inset={48} /> : null}
          </Animated.View>
        ))}
      </Panel>

      <Panel flush>
        <PressableScale
          style={styles.row}
          onPress={() => setSettingsVisible(true)}
          accessibilityLabel={t('settings')}
        >
          <View style={styles.rowIcon}>
            <Settings size={17} color={theme.colors.primary} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('settings')}</Text>
            <Text style={styles.rowSub}>{t('moreSettingsSub')}</Text>
          </View>
          <ChevronRight size={15} color={theme.colors.textDark} strokeWidth={2} />
        </PressableScale>
      </Panel>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </ScrollView>
  );
};

const SubScreen: React.FC<{
  title: string;
  onBack: () => void;
  theme: AppTheme;
  children: React.ReactNode;
}> = ({ title, onBack, theme, children }) => (
  <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <PressableScale onPress={onBack} hitSlop={12} accessibilityLabel="Retour">
        <ChevronRight
          size={18}
          color={theme.colors.primary}
          strokeWidth={2}
          style={{ transform: [{ rotate: '180deg' }] }}
        />
      </PressableScale>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.type.micro,
          fontFamily: theme.fonts.monoBold,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
    </View>
    <View style={{ flex: 1 }}>{children}</View>
  </View>
);

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    screenTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.display,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: -0.6,
      marginBottom: theme.spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    rowIcon: { width: 20, alignItems: 'center' },
    rowTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sansSemiBold,
    },
    rowSub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 2,
    },
    rowCount: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
  });
