import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './src/api/supabaseClient';
import { theme } from './src/theme';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TradesScreen } from './src/screens/TradesScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { PlaybookScreen } from './src/screens/PlaybookScreen';
import { LayoutGrid, BookOpen, Wallet, Calendar, BarChart2, BookMarked } from 'lucide-react-native';

const queryClient = new QueryClient();
const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.centerScreen}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <AuthScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
          <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: theme.colors.card,
                borderTopColor: theme.colors.cardBorder,
                height: 64,
                paddingBottom: 8,
                paddingTop: 6,
              },
              tabBarActiveTintColor: theme.colors.primaryLight,
              tabBarInactiveTintColor: theme.colors.textMuted,
              tabBarLabelStyle: {
                fontSize: 9,
                fontWeight: '800',
              },
            }}
          >
            <Tab.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{
                tabBarLabel: 'DASHBOARD',
                tabBarIcon: ({ color }) => <LayoutGrid color={color} size={18} />,
              }}
            />
            <Tab.Screen
              name="Trades"
              component={TradesScreen}
              options={{
                tabBarLabel: 'TRADES',
                tabBarIcon: ({ color }) => <BookOpen color={color} size={18} />,
              }}
            />
            <Tab.Screen
              name="Calendrier"
              component={CalendarScreen}
              options={{
                tabBarLabel: 'CALENDRIER',
                tabBarIcon: ({ color }) => <Calendar color={color} size={18} />,
              }}
            />
            <Tab.Screen
              name="Analytics"
              component={AnalyticsScreen}
              options={{
                tabBarLabel: 'ANALYTICS',
                tabBarIcon: ({ color }) => <BarChart2 color={color} size={18} />,
              }}
            />
            <Tab.Screen
              name="Playbook"
              component={PlaybookScreen}
              options={{
                tabBarLabel: 'PLAYBOOK',
                tabBarIcon: ({ color }) => <BookMarked color={color} size={18} />,
              }}
            />
            <Tab.Screen
              name="Comptes"
              component={AccountsScreen}
              options={{
                tabBarLabel: 'COMPTES',
                tabBarIcon: ({ color }) => <Wallet color={color} size={18} />,
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </QueryClientProvider>
  </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
