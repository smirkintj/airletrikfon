import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import { authEnabled } from "@/lib/auth";
import "./globals.css";

const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Billsight",
  description: "Household bills, read and totted up.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0f0e" },
    { media: "(prefers-color-scheme: light)", color: "#f1f0ea" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh font-sans text-[15px] leading-relaxed">
        <Nav signOut={authEnabled()} />
        <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-6 md:pb-12">{children}</main>
      </body>
    </html>
  );
}
