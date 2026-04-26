import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — DISTRO Nepal",
  description: "Nepal's wholesale ordering platform for shopkeepers.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-4">About DISTRO</h1>
      <p className="text-ink text-lg mb-6">
        <span className="font-semibold">DISTRO Nepal Pvt Ltd</span> — Nepal&apos;s wholesale ordering platform for shopkeepers.
      </p>
      <p className="text-blue font-grotesk text-xl font-semibold mb-8">&ldquo;Wholesale, made simple.&rdquo;</p>

      <p className="text-ink mb-6">
        DISTRO lets shopkeepers across Nepal order in bulk directly from our warehouse, with same-week delivery to most
        districts. No middlemen, transparent pricing, and proper IRD-compliant VAT invoices on every order.
      </p>

      <section className="mt-8 bg-blue-pale rounded-2xl p-6">
        <h2 className="font-grotesk text-xl font-semibold text-ink mb-3">Contact</h2>
        <ul className="text-ink space-y-1.5">
          <li>Phone / WhatsApp: <span className="font-medium">+977 9851017265</span></li>
          <li>Email: <a href="mailto:info@distronepal.com" className="text-blue hover:underline">info@distronepal.com</a></li>
          <li>Address: Kathmandu, Nepal</li>
        </ul>
        <p className="mt-4">
          <Link href="/coverage" className="text-blue hover:underline">View delivery coverage →</Link>
        </p>
      </section>
    </div>
  );
}
