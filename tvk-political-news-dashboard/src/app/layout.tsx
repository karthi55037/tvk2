import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TVK Political Dashboard — Tamilaga Vettri Kazhagam",
  description:
    "Live news analysis dashboard for Tamilaga Vettri Kazhagam (TVK) led by Vijay. Tracks news, sentiment, MLAs, criminal cases, and manifesto promises.",
  keywords: ["TVK", "Tamilaga Vettri Kazhagam", "Vijay", "Tamil Nadu Politics", "Political Dashboard"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
