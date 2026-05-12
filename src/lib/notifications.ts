import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const KICKOFF_ID_KEY = 'kickoff';
const SHUTDOWN_ID_KEY = 'shutdown';

// Show notifications even while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function registerNotificationHandlers() {
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('rituals', {
      name: 'Daily rituals',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ffffff',
    });
  }
}

async function ensurePermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

export async function scheduleDailyRituals(force = false): Promise<void> {
  const ok = await ensurePermissions();
  if (!ok) return;

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const has = (key: string) => existing.some((n) => n.identifier === key);

  if (!has(KICKOFF_ID_KEY) || force) {
    if (has(KICKOFF_ID_KEY)) await Notifications.cancelScheduledNotificationAsync(KICKOFF_ID_KEY);
    await Notifications.scheduleNotificationAsync({
      identifier: KICKOFF_ID_KEY,
      content: {
        title: 'Morning kickoff',
        body: "5 minutes. Pick the MITs. Set the anchor.",
        data: { route: '/kickoff' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 7,
        minute: 0,
        repeats: true,
      } as Notifications.CalendarTriggerInput,
    });
  }

  if (!has(SHUTDOWN_ID_KEY) || force) {
    if (has(SHUTDOWN_ID_KEY)) await Notifications.cancelScheduledNotificationAsync(SHUTDOWN_ID_KEY);
    await Notifications.scheduleNotificationAsync({
      identifier: SHUTDOWN_ID_KEY,
      content: {
        title: 'Evening shutdown',
        body: 'Close the loops. One win. Done.',
        data: { route: '/shutdown' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 20,
        minute: 0,
        repeats: true,
      } as Notifications.CalendarTriggerInput,
    });
  }
}

export async function cancelDailyRituals(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(KICKOFF_ID_KEY).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(SHUTDOWN_ID_KEY).catch(() => {});
}

export async function getScheduledRituals(): Promise<{ kickoff?: string; shutdown?: string }> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const find = (id: string) => all.find((n) => n.identifier === id);
  const fmt = (n: Notifications.NotificationRequest | undefined) => {
    if (!n) return undefined;
    const t = n.trigger as unknown as { hour?: number; minute?: number };
    if (typeof t?.hour === 'number') {
      const h = t.hour;
      const m = String(t.minute ?? 0).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      return `daily at ${hr}:${m} ${ampm}`;
    }
    return 'scheduled';
  };
  return { kickoff: fmt(find(KICKOFF_ID_KEY)), shutdown: fmt(find(SHUTDOWN_ID_KEY)) };
}

export async function testNotificationNow(): Promise<void> {
  const ok = await ensurePermissions();
  if (!ok) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Test', body: 'Notifications are working.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    } as Notifications.TimeIntervalTriggerInput,
  });
}
