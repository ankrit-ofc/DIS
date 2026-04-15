import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-ink text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <p className="font-grotesk font-bold text-2xl text-blue mb-2">
              DISTRO
            </p>
            <p className="text-gray-400 text-sm mb-1">Wholesale, made simple.</p>
            <p className="text-gray-400 text-sm">
              Nepal&apos;s easiest B2B ordering platform for shopkeepers.
            </p>
            <p className="text-gray-400 text-xs mt-4">
              Order in bulk. Deliver to your door.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-grotesk font-semibold text-sm uppercase tracking-wider text-gray-400 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              {[
                { href: "/catalogue", label: "Catalogue" },
                { href: "/coverage", label: "Coverage" },
                { href: "/track", label: "Track Order" },
                { href: "/faq", label: "FAQ" },
                { href: "/about", label: "About" },
                { href: "/privacy", label: "Privacy Policy" },
                { href: "/terms", label: "Terms & Conditions" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-grotesk font-semibold text-sm uppercase tracking-wider text-gray-400 mb-4">
              Support
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>WhatsApp: +977 9800000000</li>
              <li>Mon–Sat, 9am–6pm</li>
              <li className="mt-3">
                <span className="text-xs">Payments accepted:</span>
                <p className="mt-1">eSewa · Khalti · Cash on Delivery</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} DISTRO. All rights reserved.</p>
          <p>Made in Nepal 🇳🇵</p>
        </div>
      </div>
    </footer>
  );
}
