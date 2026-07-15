"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CATEGORY_ICON_GROUPS } from "@/lib/constants/category-icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/components/category/category-icon";

/**
 * IconPicker (028-category-lucide-icons, T016).
 *
 * 替换 EmojiPicker —— 从 emoji 字符网格迁移到 lucide 矢量图标网格。
 * 沿用 024 沉淀的 Popover + Tabs 骨架,交互行为零回归。
 *
 * Layout:
 * - Trigger: button showing current icon or placeholder
 * - Popover content: search Input + Tabs (13 groups) + grid of CategoryIcon
 * - Click icon → onChange(iconName) + close
 */
export interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(
    CATEGORY_ICON_GROUPS[0]!.id,
  );
  const [search, setSearch] = useState("");

  // Search: filter across all groups; otherwise only the active group.
  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length > 0) {
      return CATEGORY_ICON_GROUPS.flatMap((g) =>
        g.icons.map((icon) => ({ icon, groupLabel: g.label })),
      ).filter(
        ({ icon, groupLabel }) =>
          icon.includes(q) || groupLabel.toLowerCase().includes(q),
      );
    }
    return (
      CATEGORY_ICON_GROUPS.find((g) => g.id === activeGroup)?.icons.map(
        (icon) => ({ icon, groupLabel: "" }),
      ) ?? []
    );
  }, [search, activeGroup]);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 min-w-[80px] items-center justify-center gap-1 rounded-md border border-input bg-background px-3 hover:bg-accent"
          aria-label="选择图标"
        >
          {value ? (
            <CategoryIcon name={value} size={24} />
          ) : (
            <CategoryIcon name="circle-help" size={24} className="text-muted-foreground" />
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* search */}
        <div className="border-b border-border p-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索图标名或分类..."
            className="h-8"
            aria-label="搜索图标"
          />
        </div>

        {/* tabs (hidden when searching) */}
        {search.trim().length === 0 ? (
          <Tabs value={activeGroup} onValueChange={setActiveGroup}>
            <TabsList className="flex w-full flex-nowrap justify-start overflow-x-auto rounded-none bg-transparent p-1 h-auto">
              {CATEGORY_ICON_GROUPS.map((g) => (
                <TabsTrigger
                  key={g.id}
                  value={g.id}
                  className="data-[state=active]:bg-accent data-[state=active]:text-foreground shrink-0 text-xs"
                >
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CATEGORY_ICON_GROUPS.map((g) => (
              <TabsContent key={g.id} value={g.id} className="mt-0">
                <IconGrid
                  icons={g.icons.map((icon) => ({ icon }))}
                  value={value}
                  onSelect={handleSelect}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <IconGrid
            icons={filteredIcons}
            value={value}
            onSelect={handleSelect}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

interface IconGridProps {
  icons: readonly { icon: string }[];
  value: string;
  onSelect: (iconName: string) => void;
}

function IconGrid({ icons, value, onSelect }: IconGridProps) {
  return (
    <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto p-2">
      {icons.map(({ icon }) => (
        <button
          key={icon}
          type="button"
          onClick={() => onSelect(icon)}
          className={`flex h-10 w-10 items-center justify-center rounded transition-colors hover:bg-accent cursor-pointer ${
            value === icon ? "bg-accent ring-2 ring-ring" : ""
          }`}
          title={icon}
        >
          <CategoryIcon name={icon} size={22} />
        </button>
      ))}
      {icons.length === 0 && (
        <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">
          无匹配图标
        </p>
      )}
    </div>
  );
}
