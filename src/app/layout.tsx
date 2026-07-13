import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "BALTHASAR · 家庭记账",
  description: "10 秒记账,每天坚持。",
};

const PRIVACY_INLINE_SCRIPT = `(function(){try{if(localStorage.getItem('${process.env.NEXT_PUBLIC_PRIVACY_KEY ?? "balthasar.privacy.enabled"}')==='1'){document.documentElement.classList.add('privacy-on');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRIVACY_INLINE_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
