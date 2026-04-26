"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2, Search, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface Buyer {
  id: string;
  storeName?: string;
  ownerName?: string;
  phone: string;
  district?: string;
}

interface LastMessage {
  body: string;
  createdAt: string;
  senderRole: "BUYER" | "ADMIN";
}

interface Conversation {
  id: string;
  buyerId: string;
  status: string;
  unreadByAdmin: number;
  lastMessageAt: string;
  buyer: Buyer;
  messages: LastMessage[];
}

interface Message {
  id: string;
  body: string;
  senderRole: "BUYER" | "ADMIN";
  createdAt: string;
  sender: { storeName?: string; ownerName?: string };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AdminChatPage() {
  const { token } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const fetchConversations = useCallback(() => {
    api.get("/chat/conversations").then((res) => {
      setConversations(res.data.conversations ?? []);
    });
  }, []);

  // Poll conversation list every 10s
  useEffect(() => {
    fetchConversations();
    const t = setInterval(fetchConversations, 10000);
    return () => clearInterval(t);
  }, [fetchConversations]);

  // SSE for real-time incoming messages
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`${API_BASE}/chat/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "connected") return;
        const { conversationId, message } = data as { conversationId: string; message: Message };

        // Update conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessageAt: message.createdAt,
                  unreadByAdmin: c.id === activeConvId ? 0 : c.unreadByAdmin + 1,
                  messages: [{ body: message.body, createdAt: message.createdAt, senderRole: message.senderRole }],
                }
              : c
          )
        );

        // Append to active conversation
        if (conversationId === activeConvId) {
          setMessages((prev) => [...prev, message]);
        }
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [token, activeConvId]);

  // Load messages when active conv changes
  useEffect(() => {
    if (!activeConvId) return;
    api.get(`/chat/history?conversationId=${activeConvId}`).then((res) => {
      setMessages(res.data.messages ?? []);
      api.patch("/chat/read", { conversationId: activeConvId }).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, unreadByAdmin: 0 } : c))
      );
    });
  }, [activeConvId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !activeConvId) return;
    setSending(true);
    setInput("");
    try {
      const res = await api.post("/chat/send", { body: text, conversationId: activeConvId });
      setMessages((prev) => [...prev, res.data.message]);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  async function handleMarkResolved() {
    if (!activeConvId) return;
    await api.patch(`/chat/conversations/${activeConvId}/status`, { status: "CLOSED" }).catch(() => {});
    fetchConversations();
  }

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.buyer.storeName?.toLowerCase().includes(q) ||
      c.buyer.ownerName?.toLowerCase().includes(q) ||
      c.buyer.phone.includes(q)
    );
  });

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6 lg:-m-8">
      {/* Sidebar */}
      <div className="w-[260px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">No conversations yet</p>
          )}
          {filtered.map((conv) => {
            const lastMsg = conv.messages[0];
            const name = conv.buyer.storeName ?? conv.buyer.ownerName ?? conv.buyer.phone;
            const isActive = conv.id === activeConvId;
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-blue-50 transition-colors flex gap-3 items-start ${
                  isActive ? "bg-blue-50 border-l-2 border-l-blue" : ""
                }`}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-blue flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink truncate">{name}</span>
                    {lastMsg && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                        {formatTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-500 truncate">
                      {lastMsg
                        ? `${lastMsg.senderRole === "ADMIN" ? "You: " : ""}${lastMsg.body}`
                        : "No messages yet"}
                    </p>
                    {conv.unreadByAdmin > 0 && (
                      <span className="ml-1 flex-shrink-0 w-4 h-4 rounded-full bg-blue text-white text-[9px] font-bold flex items-center justify-center">
                        {conv.unreadByAdmin > 9 ? "9+" : conv.unreadByAdmin}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col bg-off-white min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <MessageSquare size={40} strokeWidth={1} />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="font-semibold text-ink">
                  {activeConv.buyer.storeName ?? activeConv.buyer.ownerName ?? activeConv.buyer.phone}
                </p>
                <p className="text-xs text-gray-400">
                  {activeConv.buyer.phone}
                  {activeConv.buyer.district ? ` · ${activeConv.buyer.district}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    activeConv.status === "OPEN"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {activeConv.status}
                </span>
                {activeConv.status === "OPEN" && (
                  <button
                    onClick={handleMarkResolved}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.map((msg) => {
                const isMine = msg.senderRole === "ADMIN";
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] px-4 py-2.5 text-sm leading-snug ${
                        isMine
                          ? "bg-blue text-white rounded-[10px] rounded-br-[3px]"
                          : "bg-white text-ink border border-gray-200 rounded-[10px] rounded-bl-[3px] shadow-sm"
                      }`}
                    >
                      <p>{msg.body}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? "text-blue-200" : "text-gray-400"}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-3 flex-shrink-0">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Type a reply..."
                className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue transition-colors max-h-[120px]"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-full bg-blue text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 hover:bg-blue-dark transition-colors"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
