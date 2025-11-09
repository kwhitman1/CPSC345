import { useEffect, useState } from 'react';

export default function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    async function register() {
      try {
        // placeholder for actual registration implementation
        // const t = await registerForPushNotificationsAsync();
        // setToken(t?.data ?? t?.token ?? null);
      } catch (e) {
        console.warn('push registration failed', e);
      }
    }
    register();
  }, []);
  return { token };
}
