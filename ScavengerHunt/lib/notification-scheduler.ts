import AsyncStorage from '@react-native-async-storage/async-storage';
import app from '@/lib/firebase-config';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const STORAGE_KEY_PREFIX = 'scheduledNotifications:v1:';

async function loadNotificationsModule() {
  try {
    // lazy require so app runs even if package isn't installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications: any = require('expo-notifications');
    return Notifications;
  } catch (e) {
    console.warn('expo-notifications not available:', (e as any)?.message || e);
    return null;
  }
}

export async function requestAndSetNotificationHandler(): Promise<boolean> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return false;

  try {
    // Notifications is typed as any to avoid TS errors when the package isn't present at build time
    (Notifications as any).setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlayBanner: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowList: true,
      }),
    });

    const perms = await (Notifications as any).getPermissionsAsync();
    const granted = perms.granted || perms.ios?.status === (Notifications as any).IosAuthorizationStatus.AUTHORIZED || perms.ios?.status === (Notifications as any).IosAuthorizationStatus.PROVISIONAL;
    if (!granted) {
      const req = await (Notifications as any).requestPermissionsAsync();
      const finallyGranted = req.granted || req.ios?.status === (Notifications as any).IosAuthorizationStatus.AUTHORIZED || req.ios?.status === (Notifications as any).IosAuthorizationStatus.PROVISIONAL;
      return !!finallyGranted;
    }
    return true;
  } catch (e) {
    console.warn('Failed to request notification permissions', e);
    return false;
  }
}

function parseTimeStrToUTCDate(timeStr: string, utcBaseDate = new Date()) {
  // timeStr is expected as "HH:MM" in UTC
  const parts = (timeStr || '').split(':').map(s => parseInt(s, 10));
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  const year = utcBaseDate.getUTCFullYear();
  const month = utcBaseDate.getUTCMonth();
  const day = utcBaseDate.getUTCDate();
  const hour = parts[0];
  const minute = parts[1];
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
}

export async function cancelScheduledForUser(userId: string) {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  try {
    const key = STORAGE_KEY_PREFIX + userId;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to cancel scheduled notifications', e);
  }
}

export async function scheduleNotificationsForUser(userId: string) {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return { scheduled: 0 };

  try {
    // clear previous scheduled notifications we created
    await cancelScheduledForUser(userId);

    const db = getFirestore(app);
    const phQ = query(collection(db, 'playerHunts'), where('userId', '==', userId), where('status', '==', 'STARTED'));
    const phSnap = await getDocs(phQ);
    const scheduledIds: string[] = [];
    const now = Date.now();

    for (const phDoc of phSnap.docs) {
      const ph = phDoc.data() as any;
      const huntId = ph.huntId;
      if (!huntId) continue;

      // fetch locations for this hunt
      const locQ = query(collection(db, 'locations'), where('huntId', '==', huntId));
      const locSnap = await getDocs(locQ);
      for (const locDoc of locSnap.docs) {
        const loc = locDoc.data() as any;
        // fetch TIME_WINDOW conditions for this location
        const condQ = query(collection(db, 'conditions'), where('locationId', '==', locDoc.id));
        const condSnap = await getDocs(condQ);
        for (const cDoc of condSnap.docs) {
          const cond = cDoc.data() as any;
          if (cond?.type !== 'TIME_WINDOW' || !cond?.startTime) continue;
          const startUTCDate = parseTimeStrToUTCDate(cond.startTime);
          if (!startUTCDate) continue;

          // schedule 30 minutes before
          const triggerMs = startUTCDate.getTime() - 30 * 60 * 1000;
          // if trigger is in the past, consider next day
          let scheduledMs = triggerMs;
          if (scheduledMs < now + 60 * 1000) {
            // add one day
            scheduledMs = triggerMs + 24 * 60 * 60 * 1000;
          }
          // still skip if somehow in the past
          if (scheduledMs < now + 60 * 1000) continue;

          const huntName = ph.huntName || 'Your hunt';
          const title = `Upcoming: ${huntName}`;
          const body = `Location ${loc?.name || ''} opens at ${cond.startTime} UTC (in ~30 minutes)`;

          try {
            const id = await (Notifications as any).scheduleNotificationAsync({
              content: { title, body, data: { huntId, locationId: locDoc.id, conditionId: cDoc.id } },
              trigger: { type: (Notifications as any).SchedulableTriggerInputTypes.DATE, date: new Date(scheduledMs) },
            });
            scheduledIds.push(id);
          } catch (e) {
            console.warn('Failed to schedule notification for', huntId, locDoc.id, e);
          }
        }
      }
    }

    // persist scheduled ids so we can cancel them later
    try {
      const key = STORAGE_KEY_PREFIX + userId;
      await AsyncStorage.setItem(key, JSON.stringify(scheduledIds));
    } catch (e) {
      console.warn('Failed to persist scheduled notification ids', e);
    }

    return { scheduled: scheduledIds.length };
  } catch (e) {
    console.warn('Failed to schedule notifications', e);
    return { scheduled: 0 };
  }
}
