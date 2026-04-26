import BuyerChatWrapper from "@/components/BuyerChatWrapper";

/**
 * Standalone auth screens — no site header, search, ticker, or footer.
 * Support chat is still offered (guest state invites sign-in).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-off-white">
      {children}
      <BuyerChatWrapper />
    </div>
  );
}
