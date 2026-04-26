"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  LogIn,
  MessageCircle,
  Send,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface Message {
  id: string;
  body: string;
  senderRole: "BUYER" | "ADMIN";
  createdAt: string;
  readAt?: string | null;
  /** Local flag set on optimistically-appended messages */
  pending?: boolean;
}

interface ConversationData {
  id: string;
  unreadByBuyer: number;
}

const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transformOrigin: "bottom right",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", damping: 24, stiffness: 280 },
  },
  exit: {
    opacity: 0,
    y: 16,
    scale: 0.96,
    transition: { duration: 0.18 },
  },
};

const messageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 28 },
  },
};

/** Merge a new message into a list, de-duplicating by id (and replacing
 * optimistic/pending placeholders whose body matches). */
function upsertMessage(prev: Message[], incoming: Message): Message[] {
  // Drop a pending message with the same body + role so the server copy takes over
  const withoutPending = prev.filter(
    (m) =>
      !(
        m.pending &&
        m.senderRole === incoming.senderRole &&
        m.body.trim() === incoming.body.trim()
      ),
  );
  if (withoutPending.some((m) => m.id === incoming.id)) {
    return withoutPending.map((m) => (m.id === incoming.id ? incoming : m));
  }
  return [...withoutPending, incoming];
}

export default function ChatWidget() {
  const { token, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [teaserVisible, setTeaserVisible] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const pendingCounter = useRef(0);

  const TEASER_DISMISS_KEY = "distro-chat-teaser-dismissed";

  /** Pop the proactive "We're here!" bubble as soon as the page has painted,
   *  unless the user has dismissed it or already opened the chat. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(TEASER_DISMISS_KEY) === "1") return;
    // One animation frame after mount guarantees first paint is done so the
    // pop-in animation isn't sacrificed to the initial hydration work.
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const raf = window.requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        if (!openRef.current) setTeaserVisible(true);
      }, 400);
    });
    return () => {
      window.cancelAnimationFrame(raf);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  /** Auto-hide the teaser after ~12s so it doesn't hang around forever. */
  useEffect(() => {
    if (!teaserVisible) return;
    const t = setTimeout(() => setTeaserVisible(false), 12000);
    return () => clearTimeout(t);
  }, [teaserVisible]);

  const dismissTeaser = useCallback(() => {
    setTeaserVisible(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(TEASER_DISMISS_KEY, "1");
    }
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      if (!v) {
        setUnread(0);
        setTeaserVisible(false);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(TEASER_DISMISS_KEY, "1");
        }
      }
      return !v;
    });
  }, []);

  /** Load message history when the panel is opened. */
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setHistoryLoading(true);
    api
      .get("/chat/history")
      .then((res) => {
        if (cancelled) return;
        setConversation(res.data.conversation ?? null);
        setMessages(res.data.messages ?? []);
        setUnread(0);
        if (res.data.conversation) {
          api
            .patch("/chat/read", { conversationId: res.data.conversation.id })
            .catch(() => {});
        }
      })
      .catch(() => {
        /* ignore — we'll show the empty state */
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  /** Reset local state whenever the auth identity changes (login/logout/switch).
   *  Without this, a logged-in buyer's history would briefly leak after logout. */
  useEffect(() => {
    setMessages([]);
    setConversation(null);
    setUnread(0);
  }, [token, user?.id]);

  /** Live updates via Server-Sent Events, with automatic reconnect and
   *  exponential backoff. Also reconnects eagerly when the tab comes back
   *  online / becomes visible again. */
  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let connectedFlagTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (closed || retryTimer) return;
      // 1s, 2s, 4s, 8s, 15s (capped)
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
      attempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };

    const markConnected = () => {
      attempt = 0;
      // Debounce the UI flag: avoid flashing "Reconnecting…" on a brief blip.
      if (connectedFlagTimer) clearTimeout(connectedFlagTimer);
      connectedFlagTimer = setTimeout(() => setConnected(true), 120);
    };

    const markDisconnected = () => {
      if (connectedFlagTimer) {
        clearTimeout(connectedFlagTimer);
        connectedFlagTimer = null;
      }
      // Grace period: hide the "Reconnecting" indicator for ~1.2s to avoid
      // showing it for momentary blips while the retry fires.
      setTimeout(() => {
        if (!closed && attempt > 0) setConnected(false);
      }, 1200);
    };

    const connect = () => {
      if (closed) return;
      try {
        es = new EventSource(
          `${API_BASE}/chat/stream?token=${encodeURIComponent(token)}`,
        );
      } catch {
        markDisconnected();
        scheduleReconnect();
        return;
      }

      es.addEventListener("open", markConnected);

      es.addEventListener("message", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.type === "connected") {
            markConnected();
            return;
          }
          const incoming: Message | undefined = data?.message;
          if (!incoming || !incoming.id) return;
          setMessages((prev) => upsertMessage(prev, incoming));

          if (incoming.senderRole === "ADMIN") {
            if (!openRef.current) {
              setUnread((u) => u + 1);
            } else {
              // Panel is open — mark as read immediately.
              const convId =
                data?.conversationId ?? conversationRef.current?.id;
              if (convId) {
                api
                  .patch("/chat/read", { conversationId: convId })
                  .catch(() => {});
              }
            }
          }
        } catch {
          /* swallow bad payloads */
        }
      });

      es.addEventListener("error", () => {
        markDisconnected();
        try {
          es?.close();
        } catch {
          /* noop */
        }
        es = null;
        scheduleReconnect();
      });
    };

    const handleOnline = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      attempt = 0;
      es?.close();
      es = null;
      connect();
    };

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        // If the stream died in the background, reconnect eagerly.
        if (!es || es.readyState === 2 /* CLOSED */) {
          handleOnline();
        }
      }
    };

    connect();

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (connectedFlagTimer) clearTimeout(connectedFlagTimer);
      try {
        es?.close();
      } catch {
        /* noop */
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      setConnected(false);
    };
  }, [token]);

  /** Smart auto-scroll: snap to bottom on open/history-load, smooth afterwards,
   *  and respect the user if they've scrolled up to read older messages. */
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const list = listRef.current;
    if (!open) {
      didInitialScrollRef.current = false;
      return;
    }
    if (!list) return;
    const nearBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight < 140;
    if (!didInitialScrollRef.current) {
      list.scrollTop = list.scrollHeight;
      didInitialScrollRef.current = true;
    } else if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, historyLoading]);

  /** Auto-resize textarea (capped at ~120px). */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  /** Focus the textarea when the panel opens, close on Escape. */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const MAX_MESSAGE_LEN = 2000;
  const SEND_TIMEOUT_MS = 20000;

  async function handleSend() {
    const text = input.trim().slice(0, MAX_MESSAGE_LEN);
    if (!text || sending) return;

    pendingCounter.current += 1;
    const pendingId = `pending-${Date.now()}-${pendingCounter.current}`;
    const optimistic: Message = {
      id: pendingId,
      body: text,
      senderRole: "BUYER",
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), SEND_TIMEOUT_MS);

    try {
      const res = await api.post(
        "/chat/send",
        { body: text },
        controller ? { signal: controller.signal } : undefined,
      );
      const saved: Message | undefined = res?.data?.message;
      if (!saved?.id) throw new Error("Malformed send response");

      setMessages((prev) =>
        upsertMessage(
          prev.filter((m) => m.id !== pendingId),
          saved,
        ),
      );

      if (!conversationRef.current) {
        try {
          const histRes = await api.get("/chat/history");
          setConversation(histRes?.data?.conversation ?? null);
        } catch {
          /* non-fatal — history will catch up next open */
        }
      }
    } catch {
      // Rollback optimistic message and restore text so the user can retry
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setInput(text);
    } finally {
      clearTimeout(timeout);
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Do not render for admins — they have their own chat page
  if (user?.role === "ADMIN") return null;

  return (
    <div
      className="chat-widget-root fixed right-4 md:right-5 z-[400] flex flex-col items-end gap-3 pointer-events-none"
      style={{
        bottom:
          "calc(var(--chat-bottom-offset, 20px) + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* ── Chat panel ──────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="chat-panel flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-2xl"
            style={{ height: "min(560px, 70vh)" }}
            role="dialog"
            aria-label="Support chat"
          >
            {/* Header */}
            <div className="relative overflow-hidden flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--blue)] to-[color:var(--blue-dark)]" />
              <div className="relative z-10 flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-grotesk font-bold text-sm border-2 border-white/30">
                      D
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--blue)] ${
                        connected || !token ? "bg-[color:var(--green)]" : "bg-amber-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white font-grotesk leading-tight truncate">
                      DISTRO Support
                    </h3>
                    <span className="flex items-center gap-1.5 text-[11px] text-blue-100/90">
                      {token && !connected ? (
                        <>
                          <WifiOff className="h-3 w-3" />
                          Reconnecting…
                        </>
                      ) : (
                        <>Typically replies in a few minutes</>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Guest prompt */}
            {!token && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-8 text-center bg-gradient-to-b from-[color:var(--off)] to-white">
                <div className="w-14 h-14 rounded-2xl bg-[color:var(--blue-light)] flex items-center justify-center">
                  <MessageCircle
                    size={26}
                    className="text-[color:var(--blue)]"
                  />
                </div>
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  Chat with DISTRO Support
                </p>
                <p className="text-xs text-[color:var(--gray2)] max-w-[240px] leading-relaxed">
                  Sign in to start a conversation with our team — we usually reply within a few minutes.
                </p>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex items-center gap-2 bg-[color:var(--blue)] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[color:var(--blue-dark)] transition-colors shadow-md"
                >
                  <LogIn size={14} />
                  Sign in to chat
                </Link>
              </div>
            )}

            {/* Messages + input */}
            {token && (
              <>
                <div
                  ref={listRef}
                  className="flex-1 overflow-y-auto px-3.5 py-4 space-y-2.5 bg-gradient-to-b from-[color:var(--off)] to-white"
                >
                  {historyLoading && messages.length === 0 && (
                    <div className="flex items-center justify-center py-10 text-[color:var(--gray2)]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}

                  {!historyLoading && messages.length === 0 && (
                    <motion.div
                      variants={messageVariants}
                      initial="hidden"
                      animate="visible"
                      className="flex gap-2.5"
                    >
                      <div className="w-8 h-8 rounded-full bg-[color:var(--blue-light)] flex items-center justify-center flex-shrink-0 text-[color:var(--blue)] font-grotesk text-xs font-bold">
                        D
                      </div>
                      <div className="flex flex-col gap-1 max-w-[80%]">
                        <span className="text-[11px] font-medium text-[color:var(--gray2)]">
                          DISTRO Support
                        </span>
                        <div className="rounded-2xl rounded-tl-none bg-white border border-gray-100 px-3.5 py-2.5 text-sm shadow-sm text-[color:var(--ink)]">
                          <p className="leading-relaxed">
                            Namaste
                            {user?.ownerName ? `, ${user.ownerName.split(" ")[0]}` : ""}! {greeting}. How can we help with your order today?
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                      const isMine = msg.senderRole === "BUYER";
                      return (
                        <motion.div
                          key={msg.id}
                          layout
                          variants={messageVariants}
                          initial="hidden"
                          animate="visible"
                          className={`flex ${isMine ? "flex-row-reverse" : ""} gap-2`}
                        >
                          {!isMine && (
                            <div className="w-8 h-8 rounded-full bg-[color:var(--blue-light)] flex items-center justify-center flex-shrink-0 text-[color:var(--blue)] font-grotesk text-xs font-bold">
                              D
                            </div>
                          )}
                          <div
                            className={`flex flex-col ${isMine ? "items-end" : ""} gap-1 max-w-[80%]`}
                          >
                            <div
                              className={`px-3.5 py-2 text-sm leading-relaxed break-words ${
                                isMine
                                  ? "rounded-2xl rounded-tr-sm bg-[color:var(--blue)] text-white shadow-[0_4px_14px_-4px_rgba(26,75,219,0.35)]"
                                  : "rounded-2xl rounded-tl-sm bg-white border border-gray-100 text-[color:var(--ink)] shadow-sm"
                              } ${msg.pending ? "opacity-70" : ""}`}
                            >
                              <p className="whitespace-pre-wrap">{msg.body}</p>
                            </div>
                            <span className="text-[10px] text-[color:var(--gray2)] px-0.5">
                              {msg.pending ? "Sending…" : formatTime(msg.createdAt)}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={bottomRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-gray-100 bg-white p-2.5 flex-shrink-0">
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message…"
                      rows={1}
                      className="flex-1 resize-none text-sm border border-gray-200 bg-white rounded-2xl px-3.5 py-2 outline-none transition-all placeholder:text-[color:var(--gray2)] focus:border-[color:var(--blue)]/50 focus:ring-2 focus:ring-[color:var(--blue)]/15 max-h-[120px]"
                      style={{ minHeight: 36 }}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || sending}
                      className="w-9 h-9 rounded-full bg-[color:var(--blue)] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-transform enabled:hover:scale-[1.03] enabled:active:scale-95"
                      aria-label="Send message"
                    >
                      {sending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </form>
                  <p className="mt-1.5 px-1 text-[10px] text-[color:var(--gray2)] select-none">
                    Press <kbd className="font-sans">Enter</kbd> to send • <kbd className="font-sans">Shift</kbd>+<kbd className="font-sans">Enter</kbd> for newline
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Proactive teaser bubble ─────────────────────────── */}
      <AnimatePresence>
        {!open && teaserVisible && (
          <motion.div
            key="chat-teaser"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="relative mr-1 max-w-[260px] rounded-2xl rounded-br-sm bg-white px-4 py-3 pr-8 shadow-[0_12px_32px_-8px_rgba(13,17,32,0.22)] ring-1 ring-gray-200/70"
          >
            <button
              type="button"
              onClick={dismissTeaser}
              aria-label="Dismiss support message"
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--gray2)] hover:bg-gray-100 hover:text-[color:var(--ink)] transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={toggleOpen}
              className="flex items-start gap-2.5 text-left"
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--blue-light)] text-[color:var(--blue)] font-grotesk text-[11px] font-bold">
                D
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--blue)]">
                  DISTRO Support
                </span>
                <span className="text-[13px] font-medium leading-snug text-[color:var(--ink)]">
                  Namaste! Need help with an order or catalogue? We&rsquo;re online.
                </span>
              </span>
            </button>
            {/* tail */}
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-[6px] right-5 h-3 w-3 rotate-45 bg-white ring-1 ring-gray-200/70"
              style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating action button ──────────────────────────── */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={toggleOpen}
        aria-label={open ? "Close chat" : "Open chat"}
        className={`chat-fab group relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_14px_40px_-8px_rgba(26,75,219,0.55)] transition-colors ${
          open
            ? "bg-gray-900"
            : "bg-[color:var(--blue)] hover:bg-[color:var(--blue-dark)]"
        }`}
      >
        <span className="absolute inset-0 -z-10 rounded-full bg-inherit opacity-30 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
        {!open && teaserVisible && (
          <>
            <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[color:var(--blue)] opacity-60 animate-ping" />
            <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[color:var(--blue)] opacity-40 animate-ping [animation-delay:0.6s]" />
          </>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="msg"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      <style jsx global>{`
        .chat-widget-root > * {
          pointer-events: auto;
        }
        /* Lift the FAB above the mobile bottom nav on phones */
        @media (max-width: 768px) {
          .chat-widget-root {
            --chat-bottom-offset: 76px;
          }
        }
      `}</style>
    </div>
  );
}
