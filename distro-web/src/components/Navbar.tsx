"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ShoppingCart,
  UserCircle,
  Package,
  LogOut,
  Menu,
  X,
  Search,
  MapPin,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { getSessionDisplayName, getSessionInitial } from "@/lib/utils";
import CartDrawer from "./CartDrawer";
import { PillNav } from "@/components/ui/pill-nav";
import { NavbarSearch } from "@/components/NavbarSearch";

const LINKS = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/track", label: "Track Order" },
  { href: "/coverage", label: "Coverage" },
  { href: "/faq", label: "FAQ" },
];

const PROMO_ITEMS = [
  "Free delivery on orders above Rs 5,000",
  "New products added weekly",
  "Khalti and eSewa accepted",
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems, openCart } = useCartStore();
  const { token, user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const count = totalItems();

  useEffect(() => {
    setMounted(true);
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
      <header className="distro-header safe-top" aria-label="Primary">
        {/* ── TOP BLUE BAR ─────────────────────────────── */}
        <div className="nav-top">
          <button
            type="button"
            className="nav-hamburger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link href="/" className="nav-logo-wrap" aria-label="DISTRO home">
            <span className="nav-logo-mask">
              <img src="/logo.png" alt="DISTRO" className="nav-logo-img" />
            </span>
            <span className="nav-wholesale-badge">WHOLESALE</span>
          </Link>

          <div className="nav-delivery-info">
            <MapPin size={14} />
            <span className="nav-delivery-strong">
              Next-day wholesale delivery
            </span>
            <span className="nav-delivery-muted">across the Kathmandu Valley</span>
          </div>

          <NavbarSearch variant="desktop" />

          <div className="nav-top-actions">
            <button
              type="button"
              className="nav-circle-btn"
              onClick={openCart}
              aria-label="Open distro van"
            >
              <ShoppingCart size={16} />
              <span
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
                      {user.role === "ADMIN"
                        ? "Admin Dashboard"
                        : "My Account"}
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
        </div>

        {/* ── PILL NAV ROW ─────────────────────────────── */}
        <div className="nav-middle">
          <div className="nav-middle-inner">
            <PillNav items={LINKS.map((l) => ({ name: l.label, href: l.href }))} pathname={pathname} />
          </div>
        </div>

        {/* ── PROMO MARQUEE (3rd row) ─────────────────── */}
        <div className="nav-marquee" aria-hidden="true">
          <div className="nav-marquee-track">
            {[0, 1].map((group) => (
              <div key={group} className="nav-marquee-group">
                {PROMO_ITEMS.concat(PROMO_ITEMS).map((item, i) => (
                  <span key={`${group}-${i}`} className="nav-marquee-item">
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── MOBILE DRAWER ─────────────────────────────── */}
      {mobileOpen && (
        <div
          className="nav-mobile-overlay"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="nav-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <NavbarSearch
              variant="mobile"
              onMobileClose={() => setMobileOpen(false)}
            />
            <div className="nav-mobile-links">
              {LINKS.map((l) => {
                const active =
                  pathname === l.href || pathname?.startsWith(l.href + "/");
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`nav-mobile-link${active ? " is-active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
            {loggedIn && user && (
              <div className="nav-mobile-user">
                <div className="nav-mobile-user-info">
                  <span className="nav-session-avatar" aria-hidden>
                    {sessionInitial}
                  </span>
                  <div>
                    <p className="nav-session-menu-name">{sessionLabel}</p>
                    <p className="nav-session-menu-phone">{user.phone}</p>
                  </div>
                </div>
                <Link
                  href={sessionHref}
                  className="nav-mobile-link"
                  onClick={() => setMobileOpen(false)}
                >
                  {user.role === "ADMIN" ? "Admin Dashboard" : "My Account"}
                </Link>
                {user.role === "BUYER" && (
                  <Link
                    href="/orders"
                    className="nav-mobile-link"
                    onClick={() => setMobileOpen(false)}
                  >
                    My Orders
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="nav-mobile-link nav-mobile-logout"
                >
                  Logout
                </button>
              </div>
            )}
            {!loggedIn && (
              <Link
                href="/login"
                className="nav-login-btn nav-mobile-login"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}

      <CartDrawer />

      <style jsx global>{`
        /* Slightly darker brand blue for the navbar.
           All full-bleed bars (top, middle, marquee) span the full viewport
           width. Inner content is constrained via .nav-*-inner wrappers so
           layouts stay centered and scale at any browser zoom. */
        .distro-header {
          --nav-blue: #1a4bdb;
          --nav-blue-deep: #1239b0;
          --nav-max: 90rem; /* ~1440px, scales with root font-size / zoom */
          position: relative;
          z-index: 200;
          width: 100%;
          max-width: 100%;
        }

        /* ── TOP BLUE BAR (full-bleed) ───────────────── */
        .nav-top {
          display: flex;
          align-items: center;
          gap: 1rem;
          min-height: 3.5rem;
          width: 100%;
          padding: 0.5rem clamp(1rem, 3vw, 2.5rem);
          background: var(--nav-blue);
          color: #ffffff;
        }

        .nav-logo-wrap {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          flex-shrink: 0;
        }
        /* The logo PNG has large built-in whitespace — mask crops it so the
           actual wordmark appears at a readable size. Sized in rem so it
           scales with browser zoom. */
        .nav-logo-mask {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 9rem;
          height: 2.75rem;
          background: #ffffff;
          border-radius: 0.625rem;
          overflow: hidden;
          padding: 0 0.625rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
          flex-shrink: 0;
        }
        .nav-logo-img {
          width: 14rem;
          height: auto;
          object-fit: contain;
          display: block;
        }
        .nav-wholesale-badge {
          display: inline-flex;
          align-items: center;
          height: 1.25rem;
          padding: 0 0.5rem;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 0.25rem;
          color: #ffffff;
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          flex-shrink: 0;
        }

        .nav-delivery-info {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          color: #ffffff;
          font-size: 0.8125rem;
          flex-shrink: 0;
          min-width: 0;
        }
        .nav-delivery-info svg {
          opacity: 0.9;
        }
        .nav-delivery-strong {
          font-weight: 600;
        }
        .nav-delivery-muted {
          color: rgba(255, 255, 255, 0.78);
        }

        .nav-search-outer {
          position: relative;
          flex: 1 1 20rem;
          min-width: 0;
          max-width: 36rem;
        }
        .nav-search-wrap {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          background: #ffffff;
          border-radius: 0.625rem;
          height: 2.5rem;
          padding: 0 0.25rem 0 0.875rem;
          box-shadow: 0 2px 8px rgba(13, 17, 32, 0.08);
        }
        .nav-search-dropdown {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 0.35rem);
          z-index: 400;
          max-height: min(70vh, 22rem);
          overflow-y: auto;
          overflow-x: hidden;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.625rem;
          box-shadow: 0 12px 32px rgba(13, 17, 32, 0.14);
        }
        .nav-search-dropdown-status {
          padding: 0.75rem 1rem;
          font-size: 0.8125rem;
          color: #64748b;
        }
        .nav-search-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          text-decoration: none;
          color: #0d1120;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s ease;
        }
        .nav-search-dropdown-item:hover {
          background: #f8fafc;
        }
        .nav-search-dropdown-thumb {
          flex-shrink: 0;
        }
        .nav-search-dropdown-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }
        .nav-search-dropdown-name {
          font-size: 0.8125rem;
          font-weight: 600;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nav-search-dropdown-meta {
          font-size: 0.6875rem;
          color: #64748b;
        }
        .nav-search-dropdown-price {
          flex-shrink: 0;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--nav-blue-deep);
        }
        .nav-search-dropdown-footer {
          display: block;
          padding: 0.65rem 0.75rem;
          text-align: center;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--nav-blue-deep);
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          text-decoration: none;
        }
        .nav-search-dropdown-footer:hover {
          background: #eff6ff;
        }
        .nav-mobile-search-outer {
          position: relative;
          width: 100%;
        }
        .nav-search-icon {
          color: #64748b;
          flex-shrink: 0;
        }
        .nav-search-input {
          flex: 1;
          min-width: 0;
          height: 100%;
          padding: 0 0.5rem;
          background: transparent;
          border: none;
          font-size: 0.875rem;
          color: #0d1120;
          outline: none;
        }
        .nav-search-input::placeholder {
          color: #94a3b8;
        }
        .nav-search-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.125rem;
          height: 34px;
          background: #eff3fa;
          color: var(--nav-blue-deep);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .nav-search-submit:hover {
          background: #e0e8f7;
        }

        .nav-top-actions {
          display: inline-flex;
          align-items: center;
          gap: 0.625rem;
          margin-left: auto;
          flex-shrink: 0;
        }

        .nav-circle-btn {
          position: relative;
          width: 2.25rem;
          height: 2.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
          flex-shrink: 0;
        }
        .nav-circle-btn:hover {
          background: rgba(255, 255, 255, 0.22);
          transform: translateY(-1px);
        }

        .nav-cart-badge {
          position: absolute;
          top: -0.25rem;
          right: -0.25rem;
          min-width: 1.125rem;
          height: 1.125rem;
          padding: 0 0.3125rem;
          border-radius: 999px;
          background: #ef4444;
          color: #ffffff;
          font-size: 0.625rem;
          font-weight: 700;
          line-height: 1.125rem;
          text-align: center;
          opacity: 0;
          transform: scale(0);
          transition: opacity 0.2s ease, transform 0.2s ease;
          pointer-events: none;
        }
        .nav-cart-badge.is-visible {
          opacity: 1;
          transform: scale(1);
        }

        .nav-login-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 2.25rem;
          padding: 0 1.25rem;
          background: #ffffff;
          color: var(--nav-blue-deep);
          border-radius: 999px;
          font-size: 0.8125rem;
          font-weight: 600;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          flex-shrink: 0;
        }
        .nav-login-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        }

        .nav-session {
          position: relative;
        }
        .nav-session-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .nav-session-btn:hover {
          transform: scale(1.05);
        }
        .nav-session-avatar {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 999px;
          background: #ffffff;
          color: var(--nav-blue-deep);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-grotesk), "Space Grotesk", system-ui,
            sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
        }
        .nav-session-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 0.75rem);
          width: 15rem;
          max-width: calc(100vw - 1.5rem);
          background: #ffffff;
          border: 1px solid rgba(226, 232, 240, 0.8);
          border-radius: 0.75rem;
          box-shadow: 0 12px 32px rgba(13, 17, 32, 0.18);
          overflow: hidden;
          z-index: 210;
        }
        .nav-session-menu-head {
          padding: 0.875rem 1rem;
          border-bottom: 1px solid rgba(241, 245, 249, 0.9);
        }
        .nav-session-menu-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #0d1120;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nav-session-menu-phone {
          font-size: 0.6875rem;
          color: #64748b;
          margin: 0.125rem 0 0 0;
        }
        .nav-session-menu-role {
          font-size: 0.625rem;
          font-weight: 700;
          color: var(--nav-blue-deep);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0.25rem 0 0 0;
        }
        .nav-session-menu-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.625rem 1rem;
          font-size: 0.8125rem;
          color: #0d1120;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          text-decoration: none;
          transition: background-color 0.2s ease;
        }
        .nav-session-menu-item:hover {
          background: #eff6ff;
        }
        .nav-session-menu-logout {
          color: #ef4444;
          border-top: 1px solid rgba(241, 245, 249, 0.9);
        }
        .nav-session-menu-logout:hover {
          background: #fef2f2;
        }

        /* ── MIDDLE BAR (matches the hero gradient below so edges blend) ── */
        .nav-middle {
          width: 100%;
          background: linear-gradient(
            135deg,
            rgba(239, 246, 255, 0.5) 0%,
            rgba(255, 255, 255, 1) 50%,
            rgba(250, 245, 255, 0.5) 100%
          );
          border-bottom: none;
        }
        .nav-middle-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 2.75rem;
          width: 100%;
          max-width: var(--nav-max);
          padding: 0.25rem clamp(1rem, 3vw, 2.5rem);
          margin: 0 auto;
          flex-wrap: wrap;
        }

        /* ── PROMO MARQUEE ──────────────────────────────
           Always spans the full viewport width at every zoom level — it's a
           direct child of the sticky full-width header, and also self-asserts
           width: 100%; max-width: 100vw; so no ancestor padding can shrink it. */
        .nav-marquee {
          width: 100%;
          max-width: calc(var(--nav-max) - 6rem);
          margin: 0 auto;
          overflow: hidden;
          background: var(--nav-blue);
          color: #ffffff;
          padding: 0.18rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
        }
        .nav-marquee-track {
          display: flex;
          width: max-content;
          animation: navMarquee 30s linear infinite;
          will-change: transform;
        }
        .nav-marquee-group {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding-right: 1.25rem;
          white-space: nowrap;
        }
        .nav-marquee-item {
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          position: relative;
          padding-right: 1.25rem;
        }
        .nav-marquee-item::after {
          content: "·";
          position: absolute;
          right: 0.45rem;
          color: rgba(255, 255, 255, 0.75);
        }
        @keyframes navMarquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-marquee-track {
            animation: none;
          }
        }

        /* ── Hamburger ──────────────────────────────── */
        .nav-hamburger {
          display: none;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 0.625rem;
          color: #ffffff;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
        }
        .nav-hamburger:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        /* ── Mobile overlay + drawer ────────────────── */
        .nav-mobile-overlay {
          display: none;
        }

        @media (max-width: 64rem) {
          .nav-delivery-info {
            display: none;
          }
        }

        @media (max-width: 48rem) {
          .nav-top {
            min-height: 3.25rem;
            padding: 0.375rem 0.875rem;
            gap: 0.5rem;
          }
          .nav-hamburger {
            display: inline-flex;
            order: -1;
          }
          .nav-logo-mask {
            width: 7.5rem;
            height: 2.25rem;
            padding: 0 0.375rem;
          }
          .nav-logo-img {
            width: 11rem;
          }
          .nav-wholesale-badge {
            display: none;
          }
          .nav-search-wrap {
            display: none;
          }
          .nav-middle {
            display: none;
          }
          .nav-top-actions {
            gap: 0.375rem;
          }
          .nav-login-btn {
            height: 2rem;
            padding: 0 0.875rem;
            font-size: 0.75rem;
          }
          .nav-circle-btn {
            width: 2rem;
            height: 2rem;
          }
          .nav-session-avatar {
            width: 2rem;
            height: 2rem;
          }
          .nav-marquee-item {
            font-size: 0.71875rem;
          }

          .nav-mobile-overlay {
            display: block;
            position: fixed;
            inset: 4.75rem 0 0 0;
            background: rgba(13, 17, 32, 0.5);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 250;
            animation: fadeIn 0.2s ease;
          }
          .nav-mobile-drawer {
            background: #ffffff;
            border-bottom: 1px solid rgba(226, 232, 240, 0.6);
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            box-shadow: 0 8px 24px rgba(13, 17, 32, 0.15);
          }
          .nav-mobile-search {
            position: relative;
            display: flex;
            align-items: center;
            background: #f1f5f9;
            border-radius: 0.625rem;
            padding: 0 0.75rem;
            height: 2.625rem;
          }
          .nav-mobile-search .nav-search-icon {
            color: #64748b;
            margin-right: 0.375rem;
          }
          .nav-mobile-search .nav-search-input {
            flex: 1;
            min-width: 0;
            height: 100%;
            padding: 0;
            background: transparent;
            border: none;
            font-size: 0.875rem;
            outline: none;
          }
          .nav-mobile-links {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }
          .nav-mobile-link {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            font-size: 0.9375rem;
            font-weight: 500;
            color: #334155;
            text-decoration: none;
            border-radius: 0.625rem;
            background: transparent;
            border: none;
            width: 100%;
            text-align: left;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            transition: all 0.2s ease;
          }
          .nav-mobile-link:hover,
          .nav-mobile-link:active {
            background: #eff6ff;
            color: var(--nav-blue-deep);
          }
          .nav-mobile-link.is-active {
            color: #ffffff;
            font-weight: 700;
            background: var(--nav-blue);
          }
          .nav-mobile-user {
            border-top: 1px solid rgba(226, 232, 240, 0.8);
            padding-top: 0.75rem;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }
          .nav-mobile-user-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 1rem 0.75rem;
          }
          .nav-mobile-user-info .nav-session-avatar {
            background: var(--nav-blue);
            color: #ffffff;
          }
          .nav-mobile-logout {
            color: #ef4444;
          }
          .nav-mobile-logout:hover,
          .nav-mobile-logout:active {
            background: #fef2f2;
            color: #ef4444;
          }
          .nav-mobile-login {
            display: block;
            text-align: center;
            margin-top: 0.5rem;
            background: var(--nav-blue);
            color: #ffffff;
          }
          .nav-mobile-login:hover {
            box-shadow: 0 8px 20px rgba(26, 75, 219, 0.35);
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        }
      `}</style>
    </>
  );
}
