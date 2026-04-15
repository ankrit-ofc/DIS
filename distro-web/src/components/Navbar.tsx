"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart, UserCircle, Package, LogOut } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { getSessionDisplayName, getSessionInitial } from "@/lib/utils";
import CartDrawer from "./CartDrawer";

const LINKS = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/track", label: "Track Order" },
  { href: "/coverage", label: "Coverage" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems, openCart } = useCartStore();
  const { token, user, clearAuth } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const count = totalItems();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const showBadge = mounted && count > 0;
  const loggedIn = mounted && !!token && !!user;
  const sessionHref = user?.role === "ADMIN" ? "/admin" : "/account";
  const sessionInitial = getSessionInitial(user ?? undefined);
  const sessionLabel = getSessionDisplayName(user);

  function handleLogout() {
    clearAuth();
    setMenuOpen(false);
    router.push("/login");
  }

  return (
    <>
      <nav
        className={`distro-navbar${scrolled ? " scrolled" : ""}`}
        aria-label="Primary"
      >
        {/* LEFT */}
        <div className="nav-left">
          {LINKS.map((l) => {
            const active =
              pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link${active ? " is-active" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* CENTER */}
        <div className="nav-center">
          <Link href="/" className="nav-logo" aria-label="DISTRO home">
            <span className="nav-logo-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
              </svg>
            </span>
            <span className="nav-logo-text">DISTRO</span>
          </Link>
        </div>

        {/* RIGHT */}
        <div className="nav-right">
          <button
            id="cartBtn"
            type="button"
            onClick={openCart}
            className="nav-cart-btn"
            aria-label="Open cart"
          >
            <ShoppingCart size={24} strokeWidth={2} />
            <span
              id="cartCount"
              className={`nav-cart-badge${showBadge ? " is-visible" : ""}`}
              aria-hidden={!showBadge}
            >
              {count > 99 ? "99+" : count}
            </span>
          </button>

          {!loggedIn && (
            <Link href="/login" className="nav-login-btn">
              Login
            </Link>
          )}

          {loggedIn && user && (
            <div ref={menuRef} className="nav-session">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="nav-session-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={sessionLabel}
              >
                <span className="nav-session-avatar" aria-hidden>
                  {sessionInitial}
                </span>
                <span className="nav-session-name">{sessionLabel}</span>
              </button>

              {menuOpen && (
                <div role="menu" className="nav-session-menu">
                  <div className="nav-session-menu-head">
                    <p className="nav-session-menu-name">{sessionLabel}</p>
                    <p className="nav-session-menu-phone">{user.phone}</p>
                    <p className="nav-session-menu-role">{user.role}</p>
                  </div>
                  <Link
                    href={sessionHref}
                    onClick={() => setMenuOpen(false)}
                    className="nav-session-menu-item"
                  >
                    <UserCircle size={16} />
                    {user.role === "ADMIN" ? "Admin Dashboard" : "My Account"}
                  </Link>
                  {user.role === "BUYER" && (
                    <Link
                      href="/orders"
                      onClick={() => setMenuOpen(false)}
                      className="nav-session-menu-item"
                    >
                      <Package size={16} />
                      My Orders
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="nav-session-menu-item nav-session-menu-logout"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <CartDrawer />

      <style jsx global>{`
        .distro-navbar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          height: 64px;
          padding: 0 32px;
          background: #ffffff;
          border-bottom: 1px solid #e0e4f0;
          position: sticky;
          top: 0;
          z-index: 200;
          transition: box-shadow 0.2s ease;
        }
        .distro-navbar.scrolled {
          box-shadow: 0 2px 20px rgba(37, 99, 235, 0.08);
        }

        .nav-left {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 4px;
          justify-content: flex-start;
        }
        .nav-link {
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #64748b;
          border-radius: 8px;
          text-decoration: none;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .nav-link:hover {
          background: #eff6ff;
          color: #2563eb;
        }
        .nav-link.is-active {
          color: #0d1120;
          font-weight: 700;
          background: #f8faff;
        }

        .nav-center {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }
        .nav-logo-mark {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #2563eb;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .nav-logo-text {
          font-family: var(--font-grotesk), "Space Grotesk", system-ui, sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #0d1120;
          letter-spacing: -0.5px;
          line-height: 1;
        }

        .nav-right {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 10px;
          justify-content: flex-end;
        }

        .nav-cart-btn {
          position: relative;
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #334155;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .nav-cart-btn:hover {
          background: #eff6ff;
          color: #2563eb;
        }
        .nav-cart-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: #2563eb;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          line-height: 18px;
          text-align: center;
          opacity: 0;
          transform: scale(0);
          transition: opacity 0.15s ease, transform 0.15s ease;
          pointer-events: none;
        }
        .nav-cart-badge.is-visible {
          opacity: 1;
          transform: scale(1);
        }

        .nav-login-btn {
          background: #2563eb;
          color: #ffffff;
          border-radius: 30px;
          padding: 9px 22px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: background-color 0.15s ease, transform 0.15s ease;
        }
        .nav-login-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .nav-session {
          position: relative;
        }
        .nav-session-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 14px 4px 4px;
          background: #ffffff;
          border: 1px solid #e0e4f0;
          border-radius: 999px;
          cursor: pointer;
          max-width: 220px;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .nav-session-btn:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
        }
        .nav-session-avatar {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: #2563eb;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-grotesk), "Space Grotesk", system-ui, sans-serif;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .nav-session-name {
          font-size: 13px;
          font-weight: 600;
          color: #0d1120;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }
        .nav-session-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 240px;
          background: #ffffff;
          border: 1px solid #e0e4f0;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(13, 17, 32, 0.08);
          overflow: hidden;
          z-index: 210;
        }
        .nav-session-menu-head {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .nav-session-menu-name {
          font-size: 13px;
          font-weight: 700;
          color: #0d1120;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nav-session-menu-phone {
          font-size: 11px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
        .nav-session-menu-role {
          font-size: 10px;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 4px 0 0 0;
        }
        .nav-session-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          font-size: 13px;
          color: #0d1120;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          text-decoration: none;
          transition: background-color 0.15s ease;
        }
        .nav-session-menu-item:hover {
          background: #eff6ff;
        }
        .nav-session-menu-logout {
          color: #ef4444;
          border-top: 1px solid #f1f5f9;
        }
        .nav-session-menu-logout:hover {
          background: #fef2f2;
        }
      `}</style>
    </>
  );
}
