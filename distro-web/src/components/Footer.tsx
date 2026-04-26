import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { AppStoreButton } from "@/components/ui/app-store-button";
import { PlayStoreButton } from "@/components/ui/play-store-button";
interface FooterLink {
  text: string;
  href: string;
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

const SHOP_LINKS: FooterLink[] = [
  { text: "Catalogue", href: "/catalogue" },
  { text: "Coverage Area", href: "/coverage" },
  { text: "Track Order", href: "/track" },
  { text: "FAQ", href: "/faq" },
];

const COMPANY_LINKS: FooterLink[] = [
  { text: "About DISTRO", href: "/about" },
  { text: "Privacy Policy", href: "/privacy" },
  { text: "Terms & Conditions", href: "/terms" },
];

const SUPPORT_ITEMS: { type: "link" | "text"; text: string; href?: string }[] = [
  { type: "link", text: "Help Center", href: "/faq" },
  {
    type: "link",
    text: "WhatsApp: +977 9851017265",
    href: "https://wa.me/9779851017265",
  },
  { type: "text", text: "Mon–Sat, 9 AM – 6 PM" },
];

const PAYMENT_TAGS = ["eSewa", "Khalti", "COD"] as const;

const SOCIAL_LINKS = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    Icon: IconFacebook,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    Icon: IconInstagram,
  },
  {
    label: "Chat on WhatsApp",
    href: "https://wa.me/9779851017265",
    Icon: MessageCircle,
  },
] as const;

const linkClass =
  "text-[color:var(--gray-600)] hover:text-[color:var(--blue)] transition-colors text-sm font-medium";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="relative mt-8 border-t border-slate-200/90 bg-white text-[color:var(--ink)]">
        <div className="mx-auto w-full max-w-7xl px-6 pt-12 pb-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8 xl:gap-10">
            {/* Column 1 — Brand & contact */}
            <div className="lg:col-span-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 no-underline"
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
                  <Image
                    src="/logo.png"
                    alt=""
                    width={44}
                    height={44}
                    className="h-9 w-auto object-contain p-1"
                  />
                </span>
                <span className="font-display text-lg font-bold tracking-tight text-[color:var(--ink)]">
                  DISTRO
                </span>
              </Link>

              <p className="mt-4 text-base font-bold text-[color:var(--ink)]">
                Wholesale, made simple.
              </p>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[color:var(--gray-600)]">
                The Kathmandu Valley&apos;s easiest B2B ordering platform for
                shopkeepers. Order in bulk. Delivered to your door across the
                Kathmandu Valley.
              </p>

              <ul className="mt-4 space-y-2.5">
                <li className="flex gap-2 text-sm">
                  <Phone
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--blue)]"
                    aria-hidden
                  />
                  <a
                    href="tel:+9779851017265"
                    className="text-[color:var(--gray-600)] hover:text-[color:var(--blue)]"
                  >
                    +977 9851017265
                  </a>
                </li>
                <li className="flex gap-2 text-sm">
                  <Mail
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--blue)]"
                    aria-hidden
                  />
                  <a
                    href="mailto:support@distro.com.np"
                    className="text-[color:var(--gray-600)] hover:text-[color:var(--blue)]"
                  >
                    support@distro.com.np
                  </a>
                </li>
                <li className="flex gap-2 text-sm">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--blue)]"
                    aria-hidden
                  />
                  <span className="text-[color:var(--gray-600)]">
                    Kathmandu, Nepal
                  </span>
                </li>
              </ul>

              <div className="mt-6">
                <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--gray-600)]">
                  Payments:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PAYMENT_TAGS.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[color:var(--blue-light)] px-3.5 py-1 text-sm font-semibold text-[color:var(--blue)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2 — Shop */}
            <div className="lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--ink)]">Shop</h3>
              <ul className="space-y-2">
                {SHOP_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3 — Company */}
            <div className="lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--ink)]">Company</h3>
              <ul className="space-y-2">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4 — Support */}
            <div className="lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--ink)]">Support</h3>
              <ul className="space-y-2">
                {SUPPORT_ITEMS.map((item) => (
                  <li key={item.text}>
                    {item.type === "link" && item.href ? (
                      <a
                        href={item.href}
                        className={linkClass}
                        {...(item.href.startsWith("http")
                          ? {
                              target: "_blank",
                              rel: "noopener noreferrer",
                            }
                          : {})}
                      >
                        {item.text}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-[color:var(--gray-600)]">
                        {item.text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 5 — Social & apps */}
            <div className="lg:col-span-3">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--ink)]">
                Follow us
              </h3>
              <div className="flex flex-wrap gap-3">
                {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--blue-light)] text-[color:var(--blue)] transition hover:bg-blue-100"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>

              <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-[color:var(--ink)]">
                Get the app
              </h3>
              <div className="flex max-w-[13rem] flex-col gap-3">
                <AppStoreButton
                  type="button"
                  className="h-8 w-full justify-start rounded-lg border-0 bg-black text-white hover:bg-zinc-900"
                />
                <PlayStoreButton
                  type="button"
                  className="h-8 w-full justify-start rounded-lg border-0 bg-black text-white hover:bg-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-5 text-xs text-gray-400 md:flex-row md:items-center">
            <p>
              &copy; {year} DISTRO. All rights reserved. Made in Nepal{" "}
              <span className="font-medium" aria-hidden>
                NP
              </span>
            </p>
            <ul className="flex flex-wrap gap-6">
              <li>
                <Link
                  href="/terms"
                  className="font-medium hover:text-[color:var(--blue)]"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="font-medium hover:text-[color:var(--blue)]"
                >
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}
