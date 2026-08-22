import { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';

import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './src/api/supabaseClient';
import { useTheme } from './src/theme';
import { useT } from './src/i18n';
import { TopAccountBar } from './src/components/common/TopAccountBar';
import { AnimatedSplashScreen } from './src/components/common/AnimatedSplashScreen';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';

// Empêche le splash screen natif de disparaître avec un écran blanc
SplashScreen.preventAutoHideAsync().catch(() => {});
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TradesScreen } from './src/screens/TradesScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { PlaybookScreen } from './src/screens/PlaybookScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { LayoutGrid, BookOpen, Wallet, Calendar, BarChart2, BookMarked, Target } from 'lucide-react-native';
import { FloatingActionButton } from './src/components/common/FloatingActionButton';
import { DailyLockOverlay } from './src/components/common/DailyLockOverlay';
import { TradeFormModal } from './src/components/trades/TradeFormModal';
import { useUIStore } from './src/store/uiStore';
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

const queryClient = new QueryClient();
const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
  const { theme } = useTheme();
  const { t } = useT();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashFinished, setSplashFinished] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [globalTradeModal, setGlobalTradeModal] = useState(false);
  const [lockOverlayDismissed, setLockOverlayDismissed] = useState(false);
  const isDailySessionLocked = useUIStore((state: { isDailySessionLocked: boolean }) => state.isDailySessionLocked);

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
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const showSplash = !splashFinished;

  return (
    <SafeAreaProvider>
      <View style={[styles.appContainer, { backgroundColor: theme.colors.background }]}>
        <QueryClientProvider client={queryClient}>
          {isPasswordRecovery ? (
            <View style={styles.appContainer}>
              <ResetPasswordScreen
                onPasswordReset={() => setIsPasswordRecovery(false)}
              />
            </View>
          ) : (
            <SafeAreaView
              style={styles.appContainer}
              edges={['top', 'left', 'right']}
            >
              <ToastContainer />
              {session && <TopAccountBar />}
              <NavigationContainer>
                <ErrorBoundary screenName="Navigation">
                  {!session ? (
                    <AuthScreen />
                  ) : (
                    <>
                      <Tab.Navigator
                        screenOptions={{
                          headerShown: false,
                          tabBarStyle: {
                            backgroundColor: theme.colors.backgroundElevated,
                            borderTopColor: theme.colors.cardBorder,
                            borderTopWidth: 1,
                            height: 64,
                            paddingBottom: 8,
                            paddingTop: 6,
                          },
                          tabBarActiveTintColor: theme.colors.primaryLight,
                          tabBarInactiveTintColor: theme.colors.textDark,
                          tabBarLabelStyle: {
                            fontSize: 9,
                            fontWeight: '800',
                            letterSpacing: 0.5,
                            marginTop: 2,
                          },
                        }}
                      >
                        <Tab.Screen
                          name="Dashboard"
                          component={DashboardScreen}
                          options={{
                            tabBarLabel: t('tabDashboard'),
                            tabBarIcon: ({ color }) => <LayoutGrid color={color} size={20} />,
                          }}
                        />
                        <Tab.Screen
                          name="Trades"
                          component={TradesScreen}
                          options={{
                            tabBarLabel: t('tabTrades'),
                            tabBarIcon: ({ color }) => <BookOpen color={color} size={20} />,
                          }}
                        />
                        <Tab.Screen
                          name="Calendar"
                          component={CalendarScreen}
                          options={{
                            tabBarLabel: t('tabCalendar'),
                            tabBarIcon: ({ color }) => <Calendar color={color} size={20} />,
                          }}
                        />
                        <Tab.Screen
                          name="Analytics"
                          component={AnalyticsScreen}
                          options={{
                            tabBarLabel: t('tabAnalytics'),
                            tabBarIcon: ({ color }) => <BarChart2 color={color} size={20} />,
                          }}
                        />
                        <Tab.Screen
                          name="Playbook"
                          component={PlaybookScreen}
                          options={{
                            tabBarLabel: t('tabPlaybook'),
                            tabBarIcon: ({ color }) => <BookMarked color={color} size={20} />,
                          }}
                        />
                        <Tab.Screen
                          name="Accounts"
                          component={AccountsScreen}
                          options={{
                            tabBarLabel: t('tabAccounts'),
                            tabBarIcon: ({ color }) => <Wallet color={color} size={20} />,
                          }}
                        />
                      </Tab.Navigator>

                      <FloatingActionButton
                        onPress={() => setGlobalTradeModal(true)}
                      />

                      <TradeFormModal
                        visible={globalTradeModal}
                        onClose={() => setGlobalTradeModal(false)}
                      />

                      <DailyLockOverlay
                        visible={isDailySessionLocked && lockOverlayDismissed === false}
                        reason="Limite de perte journalière atteinte. Mode anti-revenge trading activé."
                        onDismiss={() => setLockOverlayDismissed(true)}
                      />
                    </>
                  )}
                </ErrorBoundary>
              </NavigationContainer>
            </SafeAreaView>
          )}
        </QueryClientProvider>

        {/* ── Splash overlay on top — smoothly covers until animation ends ── */}
        {showSplash && (
          <View style={StyleSheet.absoluteFill} pointerEvents={splashFinished ? 'none' : 'auto'}>
            <AnimatedSplashScreen onAnimationFinish={() => setSplashFinished(true)} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
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
