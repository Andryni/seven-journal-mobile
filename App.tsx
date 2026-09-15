import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash screen from auto-hiding
// It stays visible until we explicitly call hideAsync()
SplashScreen.preventAutoHideAsync();
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister, PERSIST_MAX_AGE } from './src/api/queryClient';
import { OfflineBanner } from './src/components/common/OfflineBanner';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './src/api/supabaseClient';
import { useTheme } from './src/theme';
import { useT } from './src/i18n';
import { TopAccountBar } from './src/components/common/TopAccountBar';
import { AnimatedSplashScreen } from './src/components/common/AnimatedSplashScreen';
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
import { LayoutGrid, BookOpen, Calendar, BarChart2, MoreHorizontal } from 'lucide-react-native';
import { ToastContainer } from './src/components/ui/ToastContainer';
import type { RootTabParamList } from './src/types/navigation';
import type { Session } from '@supabase/supabase-js';

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // When user taps reset link, Supabase fires PASSWORD_RECOVERY
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hide native splash once our AnimatedSplashScreen component has mounted
  const onSplashLayout = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  if (!splashFinished || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }} onLayout={onSplashLayout}>
          <AnimatedSplashScreen onAnimationFinish={() => setSplashFinished(true)} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={[styles.centerScreen, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
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

  // Show Reset Password screen when user arrives via email link
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
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.appContainer, { backgroundColor: theme.colors.background }]}
          edges={['top', 'left', 'right']}
        >
          <ToastContainer />
          <OfflineBanner />
          {session && <TopAccountBar />}
          <NavigationContainer>
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
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
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
