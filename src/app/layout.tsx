import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SQL Visualizer",
  description: "SQL lineage visualizer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
