import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './src/api/supabaseClient';
import { theme } from './src/theme';
import { AuthScreen } from './src/screens/AuthScreen';
import { TradesScreen } from './src/screens/TradesScreen';
import { LayoutGrid, BookOpen, User, Wallet } from 'lucide-react-native';

const queryClient = new QueryClient();
const Tab = createBottomTabNavigator();

function DashboardPlaceholder() {
  return (
    <View style={styles.centerScreen}>
      <Text style={styles.titleText}>DASHBOARD MOBILE</Text>
      <Text style={styles.subText}>Seven Journal Terminal 2026</Text>
    </View>
  );
}

function AccountsPlaceholder() {
  return (
    <View style={styles.centerScreen}>
      <Text style={styles.titleText}>COMPTES DE TRADING</Text>
      <Text style={styles.subText}>Garde-fou Anti-Revenge ($ / % Daily Loss)</Text>
    </View>
  );
}

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
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: theme.colors.card,
                borderTopColor: theme.colors.cardBorder,
                height: 60,
                paddingBottom: 8,
              },
              tabBarActiveTintColor: theme.colors.primaryLight,
              tabBarInactiveTintColor: theme.colors.textMuted,
            }}
          >
            <Tab.Screen
              name="Dashboard"
              component={DashboardPlaceholder}
              options={{
                tabBarIcon: ({ color }) => <LayoutGrid color={color} size={20} />,
              }}
            />
            <Tab.Screen
              name="Trades"
              component={TradesScreen}
              options={{
                tabBarIcon: ({ color }) => <BookOpen color={color} size={20} />,
              }}
            />
            <Tab.Screen
              name="Comptes"
              component={AccountsPlaceholder}
              options={{
                tabBarIcon: ({ color }) => <Wallet color={color} size={20} />,
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    marginTop: 4,
  },
});
