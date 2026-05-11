import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Deletion | DISTRO",
  description: "Request deletion of your DISTRO account and associated data.",
};

export default function AccountDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-4xl font-semibold mb-2">Account Deletion</h1>
      <p className="text-sm text-gray-600 mb-8">Last updated: May 10, 2026</p>

      <p className="mb-6">
        You can request deletion of your DISTRO account and all associated data at any time. We will process your request and confirm by email within 7 business days.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">How to Request Deletion</h2>
      <p className="mb-3">Send an email from the address registered on your DISTRO account to:</p>
      <p className="font-semibold mb-3">
        <a href="mailto:ankritsapkota12345@gmail.com" className="text-blue-600 underline">ankritsapkota12345@gmail.com</a>
      </p>
      <p className="mb-3">Subject line: <strong>Account Deletion Request</strong></p>
      <p className="mb-3">Include in your email:</p>
      <ul className="list-disc pl-6 mb-6">
        <li>Your registered email address</li>
        <li>Your registered phone number</li>
        <li>Your store name (as registered)</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3">What Will Be Deleted</h2>
      <ul className="list-disc pl-6 mb-6">
        <li>Account profile (name, email, phone, address)</li>
        <li>Saved delivery locations</li>
        <li>Support chat history</li>
        <li>App activity and analytics data</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3">What May Be Retained</h2>
      <p className="mb-3">We are legally required to retain certain records even after account deletion:</p>
      <ul className="list-disc pl-6 mb-6">
        <li>Order and invoice records: retained for up to 7 years to comply with Nepal tax and accounting law.</li>
        <li>Anonymized usage data: retained for analytics; no longer linked to your identity.</li>
        <li>Backup copies: may persist in encrypted backups for up to 30 days before scheduled deletion.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Processing Time</h2>
      <p className="mb-6">Account deletion requests are processed within 7 business days. You will receive email confirmation once complete.</p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Contact</h2>
      <p className="mb-3">
        Email: <a href="mailto:ankritsapkota12345@gmail.com" className="text-blue-600 underline">ankritsapkota12345@gmail.com</a>
      </p>
      <p>
        Phone: <a href="tel:+9779851017265" className="text-blue-600 underline">+977 9851017265</a>
      </p>
    </main>
  );
}
