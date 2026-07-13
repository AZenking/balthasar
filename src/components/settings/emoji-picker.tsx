"use client";

import { useMemo, useState } from "react";
import { CATEGORY_EMOJI_GROUPS } from "@/lib/constants/category-emojis";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

/**
 * EmojiPicker (024-ui-consistency US2: migrated to shadcn Popover + Tabs).
 *
 * Before (023): hand-written <button aria-expanded> + useState popover + button array tabs.
 * After (024): shadcn Popover (focus trap + Esc + outside-click) + shadcn Tabs.
 *
 * Layout:
 * - Trigger: button showing current emoji or "选图标" placeholder
 * - Popover content: search Input + Tabs (~13 groups) + grid of emojis
 * - Click emoji → onChange + close
 */
export interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(
    CATEGORY_EMOJI_GROUPS[0]!.id,
  );
  const [search, setSearch] = useState("");

  // Search: filter across all groups; otherwise only the active group.
  const filteredEmojis = useMemo(() => {
    const q = search.trim();
    if (q.length > 0) {
      return CATEGORY_EMOJI_GROUPS.flatMap((g) => g.emojis);
    }
    return CATEGORY_EMOJI_GROUPS.find((g) => g.id === activeGroup)?.emojis ?? [];
  }, [search, activeGroup]);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 min-w-[80px] items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-lg hover:bg-accent"
          aria-label="选择 emoji"
        >
          <span className="text-xl">{value || "❓"}</span>
          <span className="text-xs text-muted-foreground">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* search */}
        <div className="border-b border-border p-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 emoji..."
            className="h-8"
            aria-label="搜索 emoji"
          />
        </div>

        {/* tabs (hidden when searching) */}
        {search.trim().length === 0 ? (
          <Tabs value={activeGroup} onValueChange={setActiveGroup}>
            <TabsList className="flex w-full flex-wrap justify-start rounded-none bg-transparent p-1 h-auto">
              {CATEGORY_EMOJI_GROUPS.map((g) => (
                <TabsTrigger
                  key={g.id}
                  value={g.id}
                  className="data-[state=active]:bg-accent data-[state=active]:text-foreground shrink-0 text-xs"
                >
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CATEGORY_EMOJI_GROUPS.map((g) => (
              <TabsContent key={g.id} value={g.id} className="mt-0">
                <EmojiGrid
                  emojis={g.emojis}
                  value={value}
                  onSelect={handleSelect}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <EmojiGrid
            emojis={filteredEmojis}
            value={value}
            onSelect={handleSelect}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

interface EmojiGridProps {
  emojis: readonly string[];
  value: string;
  onSelect: (e: string) => void;
}

function EmojiGrid({ emojis, value, onSelect }: EmojiGridProps) {
  return (
    <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto p-2">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className={`flex h-9 w-9 items-center justify-center rounded text-xl transition-colors hover:bg-accent ${
            value === emoji ? "bg-accent ring-2 ring-ring" : ""
          }`}
        >
          {emoji}
        </button>
      ))}
      {emojis.length === 0 && (
        <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">
          无匹配 emoji
        </p>
      )}
    </div>
  );
}
