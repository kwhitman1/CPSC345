export default function usePushNotifications() {
useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
        setExpoPushToken(token);
        console.log("Expo Push Token:", token?.data ?? token);
    });
}
}