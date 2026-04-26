"use client";

import { ChevronUp } from "lucide-react";

export default function ScrollToTopButton() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-4 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--blue)] text-white shadow-lg transition hover:bg-[color:var(--blue-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue)] focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      aria-label="Back to top"
    >
      <ChevronUp className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
