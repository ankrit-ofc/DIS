import SiteLayoutShell from "@/components/SiteLayoutShell";

/**
 * Main storefront / marketing chrome (header, nav, ticker, footer).
 * Auth routes live under (auth) and intentionally omit this layout.
 * Admin routes (/admin/*) skip storefront chrome — see SiteLayoutShell.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteLayoutShell>{children}</SiteLayoutShell>;
}
