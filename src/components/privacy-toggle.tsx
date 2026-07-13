"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPrivacyOn, togglePrivacy } from "@/lib/privacy";

/**
 * PrivacyToggle (026-cream-amber-revamp, spec FR-C008 / research.md R5).
 *
 * Icon-only button that flips the privacy-mode flag in `localStorage` and
 * mirrors it onto `<html>.classList['privacy-on']`. All `[data-amount]`
 * nodes across the app hide instantly via CSS — no React re-render
 * needed for the visual flip.
 *
 * Hydration safety (FR-C009):
 * - SSR renders the button in the "privacy off" icon state (`on=false`)
 *   because the server has no access to localStorage.
 * - `layout.tsx` injects an inline `<head>` script that, before React
 *   hydrates, reads localStorage and adds `.privacy-on` to `<html>` so
 *   the CSS hides amounts immediately — no flash of real numbers.
 * - After mount, `useEffect` reconciles local state with the real flag
 *   so the icon swaps to `EyeOff` if privacy is on. The icon mismatch
 *   during the first paint is invisible to users (the visible state is
 *   driven by the CSS class, not by this React state).
 *
 * Scope (clarify Q1): only display-page amounts are masked. The "记一笔"
 * amount input is not decorated with `data-amount`, so it is unaffected.
 */
export function PrivacyToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    // Read the real flag after mount to avoid SSR/CSR mismatch.
    setOn(isPrivacyOn());
  }, []);

  const handleToggle = () => {
    // togglePrivacy() flips the stored value and mirrors it onto
    // <html>.classList atomically; we re-read to sync local React state.
    togglePrivacy();
    setOn(isPrivacyOn());
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={on ? "关闭隐私模式" : "开启隐私模式"}
      aria-pressed={on}
      title={on ? "关闭隐私模式" : "开启隐私模式"}
    >
      {on ? <EyeOff /> : <Eye />}
    </Button>
  );
}
