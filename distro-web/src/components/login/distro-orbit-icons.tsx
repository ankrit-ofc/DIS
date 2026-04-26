import { Box, Package, ShoppingCart, Store, Truck } from "lucide-react";
import type { OrbitIconConfig } from "@/components/ui/modern-animated-sign-in";

/** Wholesale-themed orbit icons for the login hero (no external image hosts). */
export const DISTRO_ORBIT_ICONS: OrbitIconConfig[] = [
  {
    component: () => (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue/15 text-blue">
        <Store className="h-4 w-4" />
      </div>
    ),
    className: "border-none bg-transparent",
    duration: 20,
    delay: 20,
    radius: 90,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green/15 text-green-dark">
        <Truck className="h-4 w-4" />
      </div>
    ),
    className: "border-none bg-transparent",
    duration: 20,
    delay: 10,
    radius: 90,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue/20 text-blue">
        <Package className="h-5 w-5" />
      </div>
    ),
    className: "border-none bg-transparent",
    radius: 200,
    duration: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/10 text-ink">
        <Box className="h-5 w-5" />
      </div>
    ),
    className: "border-none bg-transparent",
    radius: 200,
    duration: 20,
    delay: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green/15 text-green-dark">
        <ShoppingCart className="h-4 w-4" />
      </div>
    ),
    className: "border-none bg-transparent",
    duration: 20,
    delay: 20,
    radius: 150,
    path: false,
    reverse: true,
  },
];
