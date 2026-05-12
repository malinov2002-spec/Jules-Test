import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerNotificationHandlers, scheduleDailyRituals } from '../src/lib/notifications';
import { theme } from '../src/lib/theme';

export default function RootLayout() {
  useEffect(() => {
    registerNotificationHandlers();
    void scheduleDailyRituals();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="kickoff" options={{ title: 'Morning kickoff' }} />
          <Stack.Screen name="capture" options={{ title: 'Quick capture' }} />
          <Stack.Screen name="shutdown" options={{ title: 'Evening shutdown' }} />
          <Stack.Screen name="chat" options={{ title: 'Coach' }} />
          <Stack.Screen name="tasks/index" options={{ title: 'Tasks' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="stats" options={{ title: 'How am I doing' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
