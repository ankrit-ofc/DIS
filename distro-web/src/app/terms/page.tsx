import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — DISTRO Nepal",
  description: "DISTRO Nepal terms of service for shopkeepers.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-gray-400">Last updated: 2026-04-12</p>

      <section className="mt-8 text-ink space-y-3">
        <h2 className="font-grotesk text-xl font-semibold mt-6 mb-2">Who can use DISTRO</h2>
        <p>DISTRO is a B2B wholesale platform for registered shopkeepers operating in Nepal. Accounts are subject to verification.</p>
      </section>

      <section className="mt-4 text-ink space-y-3">
        <h2 className="font-grotesk text-xl font-semibold mt-6 mb-2">Order placement and cancellation</h2>
        <p>Orders can be cancelled by the buyer within <span className="font-semibold">30 minutes</span> of placement and only while the status is PENDING. Cancellations restore stock and credit.</p>
      </section>

      <section className="mt-4 text-ink space-y-3">
        <h2 className="font-grotesk text-xl font-semibold mt-6 mb-2">Payment terms</h2>
        <p>Cash on Delivery (COD) is due at the time of delivery. Credit terms (if offered) follow the separate written agreement with your account manager. eSewa and Khalti payments are processed immediately.</p>
      </section>

      <section className="mt-4 text-ink space-y-3">
        <h2 className="font-grotesk text-xl font-semibold mt-6 mb-2">Delivery</h2>
        <p>Estimated delivery times vary by district and are shown on the Coverage page. Delivery is subject to stock availability and local conditions.</p>
      </section>

      <section className="mt-4 text-ink space-y-3">
        <h2 className="font-grotesk text-xl font-semibold mt-6 mb-2">Returns</h2>
        <p>Damaged or incorrect items must be reported within <span className="font-semibold">24 hours</span> of delivery via WhatsApp or email. Goods must be unopened and in original packaging.</p>
      </section>

      <section className="mt-4 text-ink space-y-3">
        <h2 className="font-grotesk text-xl font-semibold mt-6 mb-2">Right to refuse service</h2>
        <p>DISTRO reserves the right to refuse or cancel service for any account that breaches these terms, provides false information, or engages in fraudulent behaviour.</p>
      </section>

      <section className="mt-4 text-ink space-y-3">
        <h2 className="font-grotesk text-xl font-semibold mt-6 mb-2">Governing law</h2>
        <p>These terms are governed by the laws of Nepal. Disputes are subject to the exclusive jurisdiction of the courts of Kathmandu.</p>
      </section>
    </div>
  );
}
