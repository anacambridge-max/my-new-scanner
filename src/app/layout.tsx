import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRIME TECHNICAL MASTER — F&O Scanner",
  description:
    "NSE F&O Prime Technical Scanner powered by Upstox Market Data. Professional trading-terminal dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
