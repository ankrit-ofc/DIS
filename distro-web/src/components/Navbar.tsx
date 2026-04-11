"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, User, Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import CartDrawer from "./CartDrawer";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { totalItems, openCart } = useCartStore();
  const { token, user, clearAuth } = useAuthStore();
  const count = totalItems();

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: "/catalogue", label: "Catalogue" },
    { href: "/coverage", label: "Coverage" },
    { href: "/track", label: "Track Order" },
  ];

  const isLoggedIn = !!token;

  return (
    <>
      <header className="sticky top-0 z-[60] h-16 bg-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="font-grotesk font-bold text-2xl text-blue tracking-tight"
          >
            <Image src="/logo.png" alt="DISTRO" width={120} height={40} />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Cart */}
            <button
              onClick={openCart}
              className="relative p-2 rounded-lg hover:bg-blue-pale transition-colors"
              aria-label="Open cart"
            >
              <ShoppingCart size={22} className="text-white" />
              {mounted && count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue text-white text-xs font-grotesk font-bold rounded-full flex items-center justify-center px-1">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>

            {/* Login / Profile */}
            {mounted && (
              isLoggedIn ? (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    href={user?.role === 'ADMIN' ? '/admin' : '/account'}
                    className="flex items-center gap-2.5 text-sm font-semibold text-ink bg-gray-50/80 border border-gray-200/50 rounded-xl px-4 py-2 hover:bg-white hover:shadow-md transition-all duration-300 max-w-[160px]"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue to-blue-dark text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                      {(user?.storeName || 'U').charAt(0)}
                    </div>
                    <span className="truncate tracking-tight">{user?.storeName || 'Account'}</span>
                  </Link>
                  <button
                    onClick={() => clearAuth()}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-blue border border-blue/20 rounded-xl px-4 py-2 hover:bg-blue hover:text-white transition-all duration-300 shadow-sm shadow-blue/10"
                >
                  <User size={16} strokeWidth={2.5} />
                  Login
                </Link>
              )
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md">
            <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-white/80 hover:text-white py-2 px-3 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {isLoggedIn ? (
                <>
                  <Link
                    href={user?.role === 'ADMIN' ? '/admin' : '/account'}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 text-sm font-medium text-ink py-2 px-3 rounded-lg hover:bg-blue-pale transition-colors"
                  >
                    <LayoutDashboard size={16} className="text-blue" />
                    {user?.storeName || 'Account Dashboard'}
                  </Link>
                  <button
                    onClick={() => { clearAuth(); setMobileOpen(false); }}
                    className="flex items-center gap-2 text-sm font-medium text-red-500 py-2 px-3 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 text-sm font-medium text-blue py-2 px-3 rounded-lg hover:bg-blue-pale transition-colors"
                >
                  <User size={16} />
                  Login
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <CartDrawer />
    </>
  );
}
