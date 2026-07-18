import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: "BALTHASAR · 家庭记账",
  description: "10 秒记账,每天坚持。",
  applicationName: "BALTHASAR",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: [{ url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BALTHASAR",
  },
};

/**
 * Viewport + theme color (PWA installability).
 *
 * `themeColor` is an array keyed by `prefers-color-scheme` so the browser /
 * OS chrome tint follows the system dark/light setting. The literal values
 * mirror the app's background tokens: light `#ffffff`, dark `#2a2a2d`
 * (dark `--background` ≈ oklch(0.18 0.01 285.89)). `maximumScale: 1`
 * disables pinch-zoom — a bookkeeping app benefits from stable form
 * layouts on mobile.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // viewportFit=cover 是 iOS Safari 识别 env(safe-area-inset-*) 的前提;
  // 缺少它,iPhone 全面屏 home indicator 区域不会触发安全区留白。
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2a2d" },
  ],
};

const PRIVACY_KEY = process.env.NEXT_PUBLIC_PRIVACY_KEY ?? "balthasar.privacy.enabled";

/**
 * 主题 + 隐私模式 inline script(026-switch 第一期 4:三选主题系统)。
 *
 * 必须在 React hydration 前执行,根据 localStorage 中存储的主题偏好
 * (system / light / dark)和系统 prefers-color-scheme 把 `<html>.dark`
 * 设置好,避免暗 → 亮 / 亮 → 暗 闪烁(FOUC)。同时同步读取隐私模式
 * 开关,加 `privacy-on` class 让金额立即被遮蔽。
 *
 * 出错时 fallback 到 dark(与原行为一致)。
 */
const THEME_INLINE_SCRIPT = `(function(){try{
  var t = localStorage.getItem('balthasar.theme') || 'system';
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = t === 'dark' || (t === 'system' && prefersDark);
  if (dark) document.documentElement.classList.add('dark');
  if (localStorage.getItem('${PRIVACY_KEY}') === '1') {
    document.documentElement.classList.add('privacy-on');
  }
} catch (e) {
  document.documentElement.classList.add('dark');
}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* suppressHydrationWarning: 因为 inline script 会改 className,
            React hydration 时已知差异,这是官方推荐 pattern(see next-themes)。 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INLINE_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
