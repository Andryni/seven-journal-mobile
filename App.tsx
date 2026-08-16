import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash screen from auto-hiding
// It stays visible until we explicitly call hideAsync()
SplashScreen.preventAutoHideAsync();
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './src/api/supabaseClient';
import { theme } from './src/theme';
import { TopAccountBar } from './src/components/common/TopAccountBar';
import { AnimatedSplashScreen } from './src/components/common/AnimatedSplashScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TradesScreen } from './src/screens/TradesScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { PlaybookScreen } from './src/screens/PlaybookScreen';
import { LayoutGrid, BookOpen, Wallet, Calendar, BarChart2, BookMarked } from 'lucide-react-native';

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
const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [splashFinished, setSplashFinished] = useState(false);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
        <View style={{ flex: 1 }} onLayout={onSplashLayout}>
          <AnimatedSplashScreen onAnimationFinish={() => setSplashFinished(true)} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.centerScreen}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.appContainer} edges={['top', 'left', 'right']}>
          {session && <TopAccountBar />}
          <NavigationContainer>
            {!session ? (
              <AuthScreen />
            ) : (
              <Tab.Navigator
                screenOptions={{
                  headerShown: false,
                  tabBarStyle: {
                    backgroundColor: '#0a0b10',
                    borderTopColor: 'rgba(255, 255, 255, 0.07)',
                    borderTopWidth: 1,
                    height: 64,
                    paddingBottom: 8,
                    paddingTop: 6,
                  },
                  tabBarActiveTintColor: '#818cf8',
                  tabBarInactiveTintColor: '#475569',
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
                    tabBarLabel: 'TABLEAU',
                    tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={20} />,
                  }}
                />
                <Tab.Screen
                  name="Trades"
                  component={TradesScreen}
                  options={{
                    tabBarLabel: 'TRADES',
                    tabBarIcon: ({ color, size }) => <BookOpen color={color} size={20} />,
                  }}
                />
                <Tab.Screen
                  name="Calendar"
                  component={CalendarScreen}
                  options={{
                    tabBarLabel: 'CALENDRIER',
                    tabBarIcon: ({ color, size }) => <Calendar color={color} size={20} />,
                  }}
                />
                <Tab.Screen
                  name="Analytics"
                  component={AnalyticsScreen}
                  options={{
                    tabBarLabel: 'ANALYTICS',
                    tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={20} />,
                  }}
                />
                <Tab.Screen
                  name="Playbook"
                  component={PlaybookScreen}
                  options={{
                    tabBarLabel: 'PLAYBOOK',
                    tabBarIcon: ({ color, size }) => <BookMarked color={color} size={20} />,
                  }}
                />
                <Tab.Screen
                  name="Accounts"
                  component={AccountsScreen}
                  options={{
                    tabBarLabel: 'COMPTES',
                    tabBarIcon: ({ color, size }) => <Wallet color={color} size={20} />,
                  }}
                />
              </Tab.Navigator>
            )}
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  centerScreen: {
    flex: 1,
    backgroundColor: '#07080a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
