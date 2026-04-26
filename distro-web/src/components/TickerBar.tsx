"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface Announcement {
  id: number;
  message: string;
}

export default function TickerBar() {
  const [messages, setMessages] = useState<string[]>([
    "Free delivery on orders above Rs 5,000 · New products added weekly · Khalti and eSewa accepted",
  ]);

  useEffect(() => {
    api
      .get<Announcement[]>("/announcements")
      .then((res) => {
        if (res.data.length > 0) {
          setMessages(res.data.map((a) => a.message));
        }
      })
      .catch(() => {
        // Use default messages on error
      });
  }, []);

  const text = messages.join(" · ");
  // Duplicate text so marquee loops seamlessly
  const content = `${text} · ${text}`;

  return (
    <div
      className="h-7 bg-blue text-white text-[11px] font-medium overflow-hidden flex items-center"
      aria-label="Announcements"
    >
      <div className="ticker-track whitespace-nowrap select-none">
        <span className="px-8">{content}</span>
        <span className="px-8" aria-hidden="true">
          {content}
        </span>
      </div>
    </div>
  );
}
