import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { colors, spacing, radius, typography } from "../../lib/theme";
import { keyboardBehavior } from "../../lib/screen";

interface Message {
  id: string;
  body: string;
  senderRole: "BUYER" | "ADMIN";
  createdAt: string;
}

interface ConversationData {
  id: string;
  unreadByBuyer: number;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Local-midnight key, so "same day" means the user's day, not UTC's. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * "Today" / "Yesterday" / "12 Mar 2026" for a date separator. Without these the
 * times read as one scrambled run (19:04 → 21:43 → 09:42 → 22:07) because a
 * conversation spanning days shows only clock times.
 */
function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** A message, or the day heading that precedes the first message of that day. */
type ChatRow =
  | { kind: "day"; id: string; label: string }
  | { kind: "message"; id: string; message: Message };

/** Interleave day separators into the (chronological) message list. */
function buildRows(messages: Message[]): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay: string | null = null;
  for (const m of messages) {
    const key = dayKey(m.createdAt);
    if (key !== lastDay) {
      rows.push({ kind: "day", id: `day-${key}`, label: formatDayLabel(m.createdAt) });
      lastDay = key;
    }
    rows.push({ kind: "message", id: m.id, message: m });
  }
  return rows;
}

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get("/chat/history");
      setConversation(res.data.conversation ?? null);
      const fetched: Message[] = res.data.messages ?? [];
      setMessages(fetched);
      if (res.data.conversation) {
        api.patch("/chat/read", { conversationId: res.data.conversation.id }).catch(() => {});
      }
    } catch {
      // network error — silently ignore
    }
  }, []);

  // Poll only while the Chat screen is focused — stops when navigating away or backgrounding.
  useFocusEffect(
    useCallback(() => {
      loadHistory();
      pollRef.current = setInterval(loadHistory, 5000);
      if (__DEV__) console.log("[chat] poll started");
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        if (__DEV__) console.log("[chat] poll stopped");
      };
    }, [loadHistory])
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await api.post("/chat/send", { body: text });
      const newMsg: Message = res.data.message;
      setMessages((prev) => {
        // Avoid duplicate if poll already picked it up
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      if (!conversation && res.data.message.conversationId) {
        loadHistory();
      }
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const rows = buildRows(messages);

  const renderRow = ({ item: row }: { item: ChatRow }) => {
    if (row.kind === "day") {
      return (
        <View style={bub.dayWrap}>
          <Text style={bub.dayLabel}>{row.label}</Text>
        </View>
      );
    }
    const item = row.message;
    const isMine = item.senderRole === "BUYER";
    return (
      <View style={[bub.row, isMine ? bub.rowRight : bub.rowLeft]}>
        <View style={[bub.bubble, isMine ? bub.sent : bub.received]}>
          <Text style={[bub.text, isMine ? bub.textSent : bub.textRecv]}>{item.body}</Text>
          <Text style={[bub.time, isMine ? bub.timeSent : bub.timeRecv]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={keyboardBehavior ? insets.top + 56 : 0}
    >
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.statusDot} />
          <Text style={s.headerTitle}>DISTRO Support</Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={renderRow}
          contentContainerStyle={[
            s.listContent,
            // Bottom-anchor: with `flexGrow: 1` alone a short conversation pins to
            // the top and leaves a large gap above the input. Pushing a short list
            // to the end puts the newest message next to the input, where a chat
            // is read from. Once the content overflows, this has no effect.
            messages.length > 0 && s.listContentEnd,
          ]}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="chatbubble-outline" size={40} color={colors.gray300} />
              <Text style={s.emptyText}>Send us a message!</Text>
              <Text style={s.emptySub}>Our team usually replies within a few minutes.</Text>
            </View>
          }
        />

        {/* Input bar. No bottom inset here: Chat is a tab screen and BuyerTabs
            already adds insets.bottom to the tab bar's height and padding, so the
            bar below us is what clears the navigation bar. Adding it again left a
            band of dead space above the tab bar. */}
        <View style={[s.inputBar, { paddingBottom: spacing.sm }]}>
          <View style={{ flex: 1, maxHeight: 80 }}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.gray400}
              multiline
              returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            <Ionicons
              name={sending ? "ellipsis-horizontal" : "paper-plane"}
              size={18}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const bub = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: spacing.sm },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  sent: {
    backgroundColor: colors.blue,
    borderBottomRightRadius: 3,
  },
  received: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderBottomLeftRadius: 3,
  },
  text: { fontSize: 14, lineHeight: 20 },
  textSent: { color: colors.white, fontFamily: typography.body },
  textRecv: { color: colors.ink, fontFamily: typography.body },
  time: { fontSize: 10, marginTop: 3 },
  timeSent: { color: "rgba(255,255,255,0.6)", textAlign: "right" },
  timeRecv: { color: colors.gray400 },
  dayWrap: { alignItems: "center", marginVertical: spacing.sm },
  dayLabel: {
    fontSize: 11,
    fontFamily: typography.bodySemiBold,
    color: colors.gray500,
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    overflow: "hidden",
  },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.blue,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: typography.heading,
    color: colors.white,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  listContentEnd: { justifyContent: "flex-end" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.heading,
    color: colors.gray600,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: typography.body,
    color: colors.gray400,
    textAlign: "center",
    maxWidth: 240,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.body,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.offWhite,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.45 },
});
