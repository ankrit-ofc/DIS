"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MapPin, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSalesStore } from "@/store/salesStore";

/**
 * Shared chrome for the sales portal: compact header + the pinned
 * "Ordering for: <shop>" banner that follows the rep through the flow.
 */
export default function SalesShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { buyer, clearBuyer } = useSalesStore();

  function handleLogout() {
    clearBuyer();
    clearAuth();
    window.location.href = "/login";
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/sales" className="font-grotesk font-bold text-base text-ink">
            DISTRO <span className="text-blue">Sales</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 truncate max-w-[120px]">
              {user?.ownerName || user?.phone}
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-[6px] text-gray-400 hover:text-ink hover:bg-gray-50 transition-colors"
              aria-label="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
        {buyer && (
          <div className="flex items-center justify-between gap-2 bg-blue text-white px-4 py-2">
            <p className="text-xs truncate">
              Ordering for:{" "}
              <span className="font-semibold">{buyer.storeName ?? buyer.phone}</span>
              {buyer.district ? <span className="opacity-75"> · {buyer.district}</span> : null}
            </p>
            {buyer.latitude == null && (
              <button
                onClick={() => router.push("/sales/location")}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium bg-white/15 hover:bg-white/25 rounded-full px-2 py-0.5 transition-colors"
              >
                <MapPin size={11} />
                Set location
              </button>
            )}
            <button
              onClick={() => {
                clearBuyer();
                router.push("/sales");
              }}
              className="shrink-0 p-1 rounded hover:bg-white/15 transition-colors"
              aria-label="Stop ordering for this shop"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
