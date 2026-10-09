import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Signal · Messenger",
  description:
    "Signal-inspired messaging assignment. Demo authentication; no end-to-end encryption.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
