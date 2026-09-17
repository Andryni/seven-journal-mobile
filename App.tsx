import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import {
  DarkTheme,
  ThemeProvider,
  type Theme as NavigationTheme,
} from '@react-navigation/native';

// The root view's background colour. Native renders it before React mounts —
// it was never set, so every first frame, rotation and cold-start gap flashed
// the OS default (white) between the splash and our first dark screen.
SystemUI.setBackgroundColorAsync('#0A0A0B');

// Prevent the native splash screen from auto-hiding
// It stays visible until we explicitly call hideAsync()
SplashScreen.preventAutoHideAsync();
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister, PERSIST_MAX_AGE } from './src/api/queryClient';
import {
  applyMutationDefaults,
  installOnlineManager,
  resumeQueuedMutations,
} from './src/api/offlineQueue';

// Replayable writes must be registered before the persisted mutation cache
// restores, or a queue saved offline would replay without a mutationFn.
applyMutationDefaults(queryClient);
// Teach React Query the truth about connectivity (NetInfo) and replay any
// queue left paused by a previous session.
installOnlineManager(queryClient);
import { OfflineBanner } from './src/components/common/OfflineBanner';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { supabase } from './src/api/supabaseClient';
import { useTheme } from './src/theme';
import { useT } from './src/i18n';
import { useUIStore } from './src/store/uiStore';
import { TopAccountBar } from './src/components/common/TopAccountBar';
import { GlobalAddTradeFab } from './src/components/trades/GlobalAddTradeFab';
import { AnimatedSplashScreen } from './src/components/common/AnimatedSplashScreen';
import { BootScreen } from './src/components/common/BootScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TradesScreen } from './src/screens/TradesScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { LockScreen } from './src/screens/LockScreen';
import { useAppLock } from './src/features/security/useAppLock';
import { LayoutGrid, BookOpen, Calendar, BarChart2, Sparkles, MoreHorizontal } from 'lucide-react-native';
import { ToastContainer } from './src/components/ui/ToastContainer';
import type { RootTabParamList } from './src/types/navigation';
import type { Session } from '@supabase/supabase-js';

// NavigationContainer ignores our theme and renders its own light background,
// another white frame that showed through while screens mounted.
const navTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0A0A0B',
    card: '#0A0A0B',
  },
};

import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
} from '@expo-google-fonts/jetbrains-mono';

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
  const { theme } = useTheme();
  const { t } = useT();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashFinished, setSplashFinished] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const appLock = useAppLock();
  const setActiveRouteName = useUIStore(state => state.setActiveRouteName);

  // Load High-Tech FinTech Google Fonts
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    JetBrainsMono_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    let cancelled = false;

    /**
     * getSession() can hang.
     *
     * With persistSession + autoRefreshToken it may attempt a token refresh
     * over the network, and on a cold start with a slow or half-open
     * connection that promise neither resolves nor rejects. setLoading(false)
     * lived only in .then(), so the app sat on the boot logo forever -- the
     * intermittent freeze reported on device.
     *
     * The session is restored from AsyncStorage regardless; onAuthStateChange
     * below delivers it as soon as it lands. So the safe behaviour is to stop
     * blocking after a short wait and let the auth listener correct us.
     */
    const stopWaiting = () => {
      if (!cancelled) setLoading(false);
    };
    const timeout = setTimeout(stopWaiting, 4000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        setSession(session);
      })
      .catch(err => {
        // A failed restore is not a fatal error: the user simply sees the
        // sign-in screen instead of being stuck on the splash.
        console.warn('[Seven Journal] session restore failed', err);
      })
      .finally(() => {
        clearTimeout(timeout);
        stopWaiting();
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // When user taps reset link, Supabase fires PASSWORD_RECOVERY
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Hide native splash once our AnimatedSplashScreen component has mounted
  const onSplashLayout = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  /**
   * Stable, because AnimatedSplashScreen restarts its animation whenever this
   * identity changes. Passed inline it was a fresh closure on every render --
   * the auth listener firing mid-animation reset the sequence, and with it the
   * only path to splashFinished.
   */
  const finishSplash = useCallback(() => setSplashFinished(true), []);

  /**
   * Publish the active tab route for overlays outside the navigator.
   * GlobalAddTradeFab reads it from the UI store to hide on Chat; it must not
   * read navigation state directly (fatal outside a navigator, see there).
   * The callback identity stays stable so the container never re-subscribes.
   */
  const handleNavStateChange = useCallback(
    (state: Parameters<NonNullable<React.ComponentProps<typeof NavigationContainer>['onStateChange']>>[0]) => {
      setActiveRouteName(state?.routes[state.index]?.name ?? null);
    },
    []
  );

  if (!splashFinished || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }} onLayout={onSplashLayout}>
          <AnimatedSplashScreen onAnimationFinish={finishSplash} fontsReady={fontsLoaded} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (loading || !appLock.ready) {
    // Session restore + biometric bootstrap: same wait as before, but the
    // BootScreen keeps the brand on screen instead of a white flash (and the
    // lock must not render before its state is settled, or the gate flickers).
    return (
      <SafeAreaProvider>
        <BootScreen />
      </SafeAreaProvider>
    );
  }

  // Biometric gate — sits above everything except the splash, so trade data
  // is never rendered behind the lock.
  if (appLock.enabled && !appLock.isUnlocked) {
    return (
      <SafeAreaProvider>
        <LockScreen
          onAuthenticate={appLock.authenticate}
          isAuthenticating={appLock.isAuthenticating}
        />
      </SafeAreaProvider>
    );
  }

  /**
   * Reset-password screen, reached via a recovery link.
   *
   * Still wired up even though AuthScreen no longer offers a "forgot
   * password" link. Those are two different things: the link is disabled
   * because the redirect back into the app is not configured, but
   * PASSWORD_RECOVERY still fires whenever a recovery link IS opened --
   * including one sent by hand from the Supabase dashboard, which is
   * currently the only way to unlock a locked-out user.
   *
   * Removing this screen would break that escape hatch. It is not dead code;
   * it is the half of the flow that works.
   */
  if (isPasswordRecovery) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.appContainer, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
          <ResetPasswordScreen
            onPasswordReset={() => {
              setIsPasswordRecovery(false);
              // After successful reset, session will be set via onAuthStateChange
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister, maxAge: PERSIST_MAX_AGE }}
      // Mutations restored from disk arrive paused; the cache is only complete
      // now, so this is the moment to try the replay.
      onSuccess={() => resumeQueuedMutations(queryClient)}
    >
      <GestureHandlerRootView style={styles.appContainer}>
      <BottomSheetModalProvider>
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.appContainer, { backgroundColor: theme.colors.background }]}
          edges={['top', 'left', 'right']}
        >
          <ToastContainer />
          <OfflineBanner />
          {session && <TopAccountBar />}
          <NavigationContainer
            theme={navTheme}
            /**
             * The active route name is published to the UI store so overlays
             * mounted OUTSIDE the navigator (GlobalAddTradeFab) can stand
             * down on specific screens. Reading it from inside those overlays
             * with useNavigationState throws when no navigator is above them
             * -- a fatal exception in release builds that killed the app on
             * boot with a restored session.
             */
            onStateChange={handleNavStateChange}
          >
            <ErrorBoundary screenName="Navigation">
            {!session ? (
              <AuthScreen />
            ) : (
              <Tab.Navigator
                screenOptions={{
                  headerShown: false,
                  tabBarStyle: {
                    backgroundColor: theme.colors.background,
                    borderTopColor: theme.colors.hairline,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    height: 62,
                    paddingBottom: 6,
                    paddingTop: 8,
                  },
                  tabBarActiveTintColor: theme.colors.primary,
                  tabBarInactiveTintColor: theme.colors.textDark,
                  tabBarLabelStyle: {
                    fontSize: 9,
                    fontFamily: theme.fonts.monoBold,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginTop: 4,
                  },
                  tabBarItemStyle: {
                    marginHorizontal: 2,
                  },
                }}
              >
                <Tab.Screen
                  name="Dashboard"
                  component={DashboardScreen}
                  options={{
                    tabBarLabel: t('tabDashboard'),
                    tabBarIcon: ({ color }) => <LayoutGrid color={color} size={19} strokeWidth={1.75} />,
                  }}
                />
                <Tab.Screen
                  name="Trades"
                  component={TradesScreen}
                  options={{
                    tabBarLabel: t('tabTrades'),
                    tabBarIcon: ({ color }) => <BookOpen color={color} size={19} strokeWidth={1.75} />,
                  }}
                />
                <Tab.Screen
                  name="Calendar"
                  component={CalendarScreen}
                  options={{
                    tabBarLabel: t('tabCalendar'),
                    tabBarIcon: ({ color }) => <Calendar color={color} size={19} strokeWidth={1.75} />,
                  }}
                />
                <Tab.Screen
                  name="Analytics"
                  component={AnalyticsScreen}
                  options={{
                    tabBarLabel: t('tabAnalytics'),
                    tabBarIcon: ({ color }) => <BarChart2 color={color} size={19} strokeWidth={1.75} />,
                  }}
                />
                <Tab.Screen
                  name="Chat"
                  component={ChatScreen}
                  options={{
                    tabBarLabel: t('tabChat'),
                    tabBarIcon: ({ color }) => (
                      <Sparkles color={color} size={19} strokeWidth={1.75} />
                    ),
                  }}
                />
                <Tab.Screen
                  name="More"
                  component={MoreScreen}
                  options={{
                    tabBarLabel: t('tabMore'),
                    tabBarIcon: ({ color }) => <MoreHorizontal color={color} size={19} strokeWidth={1.75} />,
                  }}
                />
              </Tab.Navigator>
            )}
            </ErrorBoundary>
            {/* Logging lives above the navigator so it is reachable from every
                tab, not only from Trades. Inside NavigationContainer, though,
                so it can know the active route and stand down where it would
                cover something -- the route reaches it via the UI store (see
                onStateChange above), never via useNavigationState, which
                throws outside a navigator and crashed release builds. */}
            {session ? (
              <ErrorBoundary screenName="QuickEntryFab">
                <GlobalAddTradeFab />
              </ErrorBoundary>
            ) : null}
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
      </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  centerScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
