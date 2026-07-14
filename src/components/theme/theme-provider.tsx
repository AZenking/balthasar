"use client";

/**
 * ThemeProvider(026-switch 第一期 4:三选主题系统)。
 *
 * 维护用户主题偏好 `"system" | "light" | "dark"`,并把它解析成
 * 实际生效的 `"light" | "dark"`(`resolvedTheme`):
 *   - 当 preference = "system" 时,跟随 `prefers-color-scheme: dark`
 *     媒体查询实时切换;
 *   - 否则直接固定为用户选择。
 *
 * 副作用:
 *   - 写 `<html>` 的 className(加 / 去 `dark`)。
 *   - 持久化到 `localStorage.balthasar.theme`。
 *
 * 与 layout.tsx 中 inline script 的协作:
 *   - layout.tsx 在 React hydration 前已经把 `<html>.dark` 设置好(防
 *     FOUC),所以 SSR 时本组件不需要尝试在服务端读 localStorage;
 *   - 本组件在 mount 后读 localStorage 同步 state(`theme`),并监听
 *     系统主题变化以重新解析 `resolvedTheme`,最终把 `<html>.dark` 维持
 *     在正确状态。
 *
 * 默认值:`theme = "system"`、`resolvedTheme = "dark"`(fallback),实际
 * 值在 mount 后修正。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "balthasar.theme";

type ThemeContextValue = {
  /** 用户偏好(三选)。 */
  theme: ThemePreference;
  /** 当前实际生效主题(二选,system 解析后的结果)。 */
  resolvedTheme: ResolvedTheme;
  /** 修改偏好并持久化。 */
  setTheme: (t: ThemePreference) => void;
  /** 是否已 hydration 完成(消费方据此避免首帧选中态闪烁)。 */
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
  mounted: false,
});

function applyHtmlClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  // hydration 后读 localStorage(避免 SSR/CSR mismatch) + 标记 mounted。
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "system" || stored === "light" || stored === "dark") {
        setThemeState(stored);
      }
    } catch {
      // localStorage 不可用(隐私模式),保持 system 默认。
    }
    setMounted(true);
  }, []);

  // 监听 system preference 变化(若 theme=system)。
  useEffect(() => {
    if (theme !== "system") {
      setResolvedTheme(theme);
      applyHtmlClass(theme);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyHtmlClass(next);
    };
    handler(); // 立即解析一次
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // 写入失败(隐私模式等),仅内存生效。
    }
    setThemeState(t);
  }, []);

  const contextValue = useMemo(
    () => ({ theme, resolvedTheme, setTheme, mounted }),
    [theme, resolvedTheme, setTheme, mounted],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
