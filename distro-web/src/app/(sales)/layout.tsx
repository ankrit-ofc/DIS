/**
 * Standalone sales-rep routes — no storefront chrome, mobile-first PWA
 * (same pattern as the (driver) group). Real authorization lives in the API;
 * the middleware role-cookie gate is cosmetic.
 */
export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-off-white">{children}</div>;
}
