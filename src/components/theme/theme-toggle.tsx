"use client";

/**
 * ThemeToggle(026-switch 第一期 4:三选主题 UI 控件)。
 *
 * 三选(跟随系统 / 浅色 / 深色)用 HeroUI `Tabs` 实现。
 * 任务规范建议 HeroUI `Tabs` 或 `SegmentedControl`;HeroUI v3 当前没暴露
 * SegmentedControl,因此使用 Tabs(语义上"三选一"也合适)。
 *
 * - 读取 `useTheme()` 当前 `theme`,作为 `selectedKey`
 * - 点击 → `setTheme(next)`,ThemeProvider 同步 localStorage + `<html>.dark`
 * - 在 ThemeProvider hydration 完成(theme 仍为默认 "system")前,UI 与
 *   inline script 设置的 `<html>.dark` 一致(默认 system = 跟随系统)
 */

import { Tabs } from "@heroui/react";
import { useTheme, type ThemePreference } from "./theme-provider";

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "system", label: "跟随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Tabs
      aria-label="主题切换"
      selectedKey={theme}
      onSelectionChange={(key) => setTheme(key as ThemePreference)}
    >
      <Tabs.List>
        {THEME_OPTIONS.map((opt) => (
          <Tabs.Tab key={opt.id} id={opt.id}>
            {opt.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
