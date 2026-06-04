import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { navigateToOrder } from "../navigation/navigationRef";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name: "Order updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00C46F",
    });
  }
}

export async function notifyOrderConfirmed(orderNumber: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Order Confirmed!",
      body: `Your order #${orderNumber} has been placed successfully.`,
      data: { orderNumber },
    },
    trigger: null, // immediate
  });
}

/**
 * Ensure permission + channel, then return the device's Expo push token.
 * Returns null (never throws) if not a physical device or permission denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data;
  } catch {
    return null;
  }
}

/**
 * Route a tapped notification to its order. Handles both warm taps
 * (response listener) and cold start (getLastNotificationResponseAsync).
 * Returns a cleanup function that removes the listener.
 */
export function initNotificationRouting(): () => void {
  const route = (data: any) => {
    if (data?.orderId) navigateToOrder(String(data.orderId), data.orderNumber ? String(data.orderNumber) : undefined);
  };

  // Cold start: app launched by tapping a notification.
  Notifications.getLastNotificationResponseAsync()
    .then((resp) => {
      if (resp) route(resp.notification.request.content.data);
    })
    .catch(() => {});

  // Warm: tapped while app is running/backgrounded.
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    route(resp.notification.request.content.data);
  });

  return () => sub.remove();
}
