"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQ {
  q: string;
  a: string;
}

const FAQS: FAQ[] = [
  {
    q: "How do I create an account?",
    a: "You can register using your mobile number. We'll send an OTP via SMS for verification. Once verified, your account is active and you can start ordering immediately.",
  },
  {
    q: "What is a Minimum Order Quantity (MOQ)?",
    a: "MOQ is the minimum number of units you must order for each product. For example, if a product has MOQ of 12, you must order at least 12 units. This is because we serve bulk wholesale orders.",
  },
  {
    q: "Which payment methods are accepted?",
    a: "We accept eSewa, Khalti, and Cash on Delivery (COD). Digital payments are processed instantly. COD is available for most delivery areas.",
  },
  {
    q: "How long does delivery take?",
    a: "Kathmandu Valley orders are typically delivered same day or next day. Other districts take 2–3 business days depending on location. Exact estimates are shown on the Coverage page.",
  },
  {
    q: "What is the delivery fee?",
    a: "Delivery fees vary by district. Kathmandu Valley deliveries are free for orders above Rs 5,000. You can see exact fees for your district on the Coverage page or at checkout.",
  },
  {
    q: "Can I track my order?",
    a: "Yes! Go to the Track Order page, enter your phone number and order ID to see real-time status updates across 5 stages: Placed, Confirmed, Processing, Shipped, and Delivered.",
  },
  {
    q: "Can I cancel or modify my order?",
    a: "Orders can be cancelled within 30 minutes of placing them, as long as they haven't been confirmed. Use the Cancel Order button on the order detail page, or contact us on WhatsApp at +977 9851017265 for urgent modifications.",
  },
  {
    q: "What is my credit limit?",
    a: "Your credit limit is shown on your Account page. It is set per agreement with your account manager and tracks how much you can order on credit terms. Completed COD and digital payments free up credit automatically.",
  },
  {
    q: "What if I receive damaged or wrong products?",
    a: "Please contact us within 24 hours of delivery with photos of the damaged items. We'll arrange a replacement or credit for the next order.",
  },
  {
    q: "Is there a minimum order value?",
    a: "There's no minimum order value, but delivery fees may apply for smaller orders. We recommend combining products to maximize value per delivery.",
  },
  {
    q: "How do I get invoices or VAT bills?",
    a: "VAT-compliant invoices are automatically generated for every order and can be downloaded from your order history. Invoices are IRD-compliant PDF documents.",
  },
];

function AccordionItem({ faq, isOpen, onToggle }: {
  faq: FAQ;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span
          className={`text-sm font-semibold transition-colors ${
            isOpen ? "text-blue" : "text-ink"
          }`}
        >
          {faq.q}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-96 mb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggle(i: number) {
    setOpenIndex((prev) => (prev === i ? null : i));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="font-grotesk font-bold text-3xl text-ink mb-3">
          Frequently Asked Questions
        </h1>
        <p className="text-gray-400">
          Everything you need to know about ordering from DISTRO.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 px-6">
        {FAQS.map((faq, i) => (
          <AccordionItem
            key={i}
            faq={faq}
            isOpen={openIndex === i}
            onToggle={() => toggle(i)}
          />
        ))}
      </div>

      <div className="mt-10 text-center bg-blue-pale rounded-2xl p-8">
        <p className="font-grotesk font-semibold text-ink mb-2">
          Still have questions?
        </p>
        <p className="text-sm text-gray-400 mb-4">
          Our team is available Mon–Sat, 9am–6pm.
        </p>
        <a
          href="https://wa.me/9779851017265"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue hover:bg-blue-dark text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
