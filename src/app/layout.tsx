import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Dus2 PORI — Billing & Loyalty",
    template: "%s · Dus2 PORI",
  },
  description:
    "Free billing, inventory, customer and loyalty-points software for Dus2 PORI cosmetics store.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Dus2 PORI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2a0e21",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${playfair.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
