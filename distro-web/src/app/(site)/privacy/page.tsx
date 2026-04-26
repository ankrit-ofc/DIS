import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — DISTRO Nepal",
  description: "How DISTRO Nepal collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-sm sm:prose-base">
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400">Last updated: 2026-04-12</p>

      <section className="mt-8">
        <h2 className="font-grotesk text-xl font-semibold text-ink mt-6 mb-2">What we collect</h2>
        <ul className="list-disc pl-5 text-ink">
          <li>Owner name and store / company name</li>
          <li>Phone number and email address</li>
          <li>PAN number (for registered businesses)</li>
          <li>Order history and delivery addresses</li>
          <li>Payment references from eSewa, Khalti, or Cash-on-Delivery transactions</li>
        </ul>
      </section>

      <section>
        <h2 className="font-grotesk text-xl font-semibold text-ink mt-6 mb-2">How we use your data</h2>
        <ul className="list-disc pl-5 text-ink">
          <li>Processing and delivering your wholesale orders</li>
          <li>Sending order, delivery, and account notifications via WhatsApp, SMS, or email</li>
          <li>Issuing IRD Nepal–compliant VAT tax invoices</li>
          <li>Providing customer support and account recovery</li>
        </ul>
      </section>

      <section>
        <h2 className="font-grotesk text-xl font-semibold text-ink mt-6 mb-2">Sharing</h2>
        <p className="text-ink">
          We do <span className="font-semibold">not</span> sell your data to third parties. Data is shared only with
          delivery partners and payment providers to fulfil your orders, and with tax authorities when legally required.
        </p>
      </section>

      <section>
        <h2 className="font-grotesk text-xl font-semibold text-ink mt-6 mb-2">Contact</h2>
        <p className="text-ink">
          Questions? Email <a href="mailto:info@distronepal.com" className="text-blue hover:underline">info@distronepal.com</a>.
        </p>
      </section>
    </div>
  );
}
