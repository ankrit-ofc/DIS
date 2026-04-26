import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import PwaRegister from "@/components/PwaRegister";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1A4BDB",
};

export const metadata: Metadata = {
  title: "DISTRO — Wholesale, made simple.",
  description: "The Kathmandu Valley's easiest B2B ordering platform for shopkeepers. Order in bulk. Delivered to your door across the Kathmandu Valley.",
  keywords: "wholesale, B2B, Kathmandu Valley, Nepal, bulk order, shopkeeper, DISTRO",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DISTRO",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(spaceGrotesk.variable, plusJakarta.variable, "font-sans")}
    >
      <body className="font-jakarta bg-off-white text-ink min-h-screen flex flex-col">
        <Providers>
          {children}
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
