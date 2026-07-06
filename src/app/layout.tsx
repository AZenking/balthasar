import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BALTHASAR · 家庭记账",
  description: "10 秒记账,每天坚持。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
