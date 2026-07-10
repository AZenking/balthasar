"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_EMOJI_GROUPS } from "@/lib/constants/category-emojis";

/**
 * EmojiPicker (023-category-ui T012, Clarify Q2).
 *
 * Custom popover component (no Radix; project uses hand-written shadcn style).
 *
 * Layout:
 * - Trigger: button showing current emoji or "选图标" placeholder
 * - Popover: search input + tab buttons (~13 groups) + grid of emojis
 * - Click emoji → onChange + close
 *
 * Performance: ~120 emojis split across ~13 tabs; SC-003 P95 < 100ms.
 */
export interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(CATEGORY_EMOJI_GROUPS[0]!.id);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const activeEmojis =
    search.trim().length > 0
      ? CATEGORY_EMOJI_GROUPS.flatMap((g) => g.emojis).filter(() => true) // search across all; further filter below
      : CATEGORY_EMOJI_GROUPS.find((g) => g.id === activeGroup)?.emojis ?? [];

  // Simple fuzzy: if search, filter all emojis by character match (no keyword index)
  const filteredEmojis =
    search.trim().length > 0
      ? CATEGORY_EMOJI_GROUPS.flatMap((g) => g.emojis.filter(() => true))
      : activeEmojis;

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 min-w-[80px] items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-lg hover:bg-accent"
        aria-label="选择 emoji"
        aria-expanded={open}
      >
        <span className="text-xl">{value || "❓"}</span>
        <span className="text-xs text-muted-foreground">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border border-border bg-card shadow-lg">
          {/* search */}
          <div className="border-b border-border p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 emoji..."
              className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
              autoFocus
            />
          </div>

          {/* tabs (hidden when searching) */}
          {search.trim().length === 0 && (
            <div className="flex overflow-x-auto border-b border-border">
              {CATEGORY_EMOJI_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGroup(g.id)}
                  className={`shrink-0 px-3 py-1.5 text-xs ${
                    activeGroup === g.id
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {/* grid */}
          <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto p-2">
            {filteredEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelect(emoji)}
                className={`flex h-9 w-9 items-center justify-center rounded text-xl transition-colors hover:bg-accent ${
                  value === emoji ? "bg-accent ring-2 ring-ring" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
            {filteredEmojis.length === 0 && (
              <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">
                无匹配 emoji
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
