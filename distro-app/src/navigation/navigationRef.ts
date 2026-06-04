import { createNavigationContainerRef } from "@react-navigation/native";

// Lets non-component code (e.g. a notification tap handler) drive navigation.
export const navigationRef = createNavigationContainerRef();

/** Navigate to the Orders tab → OrderDetail for the given order. */
export function navigateToOrder(orderId: string, orderNumber?: string): void {
  if (!orderId) return;
  // Cast: the untyped container ref types navigate() args as `never`.
  const go = () =>
    (navigationRef.navigate as any)("Orders", {
      screen: "OrderDetail",
      params: { orderId, orderNumber },
    });

  if (navigationRef.isReady()) {
    go();
    return;
  }

  // Cold start: the container may not be mounted yet — poll briefly for readiness.
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (navigationRef.isReady()) {
      clearInterval(timer);
      go();
    } else if (tries >= 20) {
      clearInterval(timer); // give up after ~5s
    }
  }, 250);
}
