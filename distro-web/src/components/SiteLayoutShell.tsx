"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import BuyerChatWrapper from "@/components/BuyerChatWrapper";

/**
 * Storefront chrome is omitted on /admin/* so the dashboard only shows the admin shell
 * (sidebar + content from admin/layout.tsx).
 */
export default function SiteLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-mobile-nav">{children}</main>
      <Footer />
      <MobileBottomNav />
      <BuyerChatWrapper />
    </>
  );
}
