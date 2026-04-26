/**
 * Standalone driver routes — no storefront chrome (header/ticker/footer)
 * and no support chat. Mobile-first by default.
 */
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-off-white">{children}</div>;
}
