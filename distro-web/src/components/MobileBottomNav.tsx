"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingCart, Package, User, Search } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/catalogue", label: "Catalogue", icon: LayoutGrid },
  { href: "/track", label: "Track", icon: Search },
  { href: "/cart", label: "Van", icon: ShoppingCart, showBadge: true },
  { href: "/orders", label: "Orders", icon: Package, auth: true },
  { href: "/account", label: "Account", icon: User, auth: true },
];

const GUEST_TABS = [
  { href: "/catalogue", label: "Catalogue", icon: LayoutGrid },
  { href: "/track", label: "Track", icon: Search },
  { href: "/cart", label: "Van", icon: ShoppingCart, showBadge: true },
  { href: "/coverage", label: "Coverage", icon: Package },
  { href: "/login", label: "Login", icon: User },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCartStore();
  const { token, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // Hide on admin pages
  if (pathname?.startsWith("/admin")) return null;

  const loggedIn = !!token && !!user;
  const tabs = loggedIn ? TABS : GUEST_TABS;
  const count = totalItems();

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active =
          pathname === tab.href || pathname?.startsWith(tab.href + "/");

        return (
          <Link key={tab.href} href={tab.href} className={`mbn-tab${active ? " is-active" : ""}`}>
            <span className="mbn-icon-wrap">
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {tab.showBadge && count > 0 && (
                <span className="mbn-badge">{count > 99 ? "99+" : count}</span>
              )}
            </span>
            <span className="mbn-label">{tab.label}</span>
          </Link>
        );
      })}

      <style jsx global>{`
        .mobile-bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 300;
            background: #ffffff;
            border-top: 1px solid #e0e4f0;
            padding: 6px 0 calc(6px + env(safe-area-inset-bottom, 0px));
            justify-content: space-around;
            align-items: center;
            box-shadow: 0 -2px 16px rgba(13, 17, 32, 0.06);
          }
        }

        .mbn-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          flex: 1;
          padding: 4px 0;
          text-decoration: none;
          color: #9BA3BF;
          transition: color 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .mbn-tab.is-active {
          color: #1A4BDB;
        }

        .mbn-icon-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
        }

        .mbn-badge {
          position: absolute;
          top: -4px;
          right: -8px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background: #1A4BDB;
          color: #ffffff;
          font-size: 9px;
          font-weight: 700;
          line-height: 16px;
          text-align: center;
        }

        .mbn-label {
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: 0.01em;
        }
      `}</style>
    </nav>
  );
}
