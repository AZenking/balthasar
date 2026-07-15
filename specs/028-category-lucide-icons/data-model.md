# Data Model: 分类图标迁移设计

**Feature**: 028-category-lucide-icons | **Date**: 2026-07-15

## 1. Schema 变更

**无 schema 变更**。`categories.icon` 列保持 `text NOT NULL`,只改列内容。

```sql
-- 现状(不变):
ALTER TABLE categories ALTER COLUMN icon TYPE text;
-- icon 列: text NOT NULL, 存储 emoji 字符(如 '🍔')
-- 迁移后: text NOT NULL, 存储 kebab-case 图标名(如 'utensils')
```

## 2. 常量文件设计: `category-icons.ts`

替换 `src/lib/constants/category-emojis.ts`。

### 2.1 数据结构

```typescript
// src/lib/constants/category-icons.ts

import {
  Utensils, Car, ShoppingBag, House, Lightbulb, Smartphone, Pill,
  Gamepad2, BookOpen, Shirt, Gift, CircleDollarSign, Wallet,
  PartyPopper, TrendingUp, Briefcase, ReceiptText, HandCoins,
  Undo2, Banknote, Coffee, Soup, Pizza, Cake, Beer, Wine,
  // ... 全量 import ~80 个 lucide 图标 ...
  type LucideIcon,
} from "lucide-react";

// ─── 图标名 → lucide 组件映射(O(1) 查找) ───
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  "utensils": Utensils,
  "car": Car,
  "shopping-bag": ShoppingBag,
  "house": House,
  "lightbulb": Lightbulb,
  // ... 全量 ~80 条 ...
};

// ─── 图标名白名单(校验用,O(1) Set) ───
export const CATEGORY_ICONS = Object.keys(CATEGORY_ICON_MAP) as readonly string[];
export const CATEGORY_ICON_SET: ReadonlySet<string> = new Set(CATEGORY_ICONS);

// ─── 按域分组(picker tab 用,沿用 13 组) ───
export const CATEGORY_ICON_GROUPS = [
  { id: "food", label: "食物", icons: ["utensils", "coffee", "soup", "pizza", ...] },
  { id: "transport", label: "交通", icons: ["car", "bus", "bike", "plane", ...] },
  // ... 13 组 ...
] as const;

// ─── emoji → 图标名映射(迁移 SQL 生成 + 过渡期回退用) ───
export const EMOJI_TO_ICON: Record<string, string> = {
  "🍔": "utensils",
  "🚗": "car",
  "🛍️": "shopping-bag",
  // ... 全量 ~120 条 ...
};

// ─── 校验函数(替换 isCategoryEmoji) ───
export function isCategoryIcon(value: string): boolean {
  return typeof value === "string" && CATEGORY_ICON_SET.has(value);
}
```

### 2.2 设计要点

- **图标名白名单 = map keys**: `CATEGORY_ICONS` 从 `CATEGORY_ICON_MAP` 的 keys 派生,确保零漂移
- **前端+后端同源**: 与 `category-emojis.ts` 一样,前端(zod)和后端(procedure)导入同一文件
- **EMOJI_TO_ICON**: 迁移 SQL 的 CASE 子句 + `CategoryIcon` 过渡期回退均从此表生成
- **去重后 ~80 个图标名**: ~120 emoji 语义合并后约 80 个唯一 lucide 图标

## 3. 数据迁移 SQL: `0008_category_icons.sql`

```sql
-- 0008_category_icons.sql
-- Feature 028: categories.icon emoji → lucide 图标名
-- 无 schema 变更,只改列内容。

UPDATE categories SET icon = CASE icon
  -- ── Food ──
  WHEN '🍔' THEN 'utensils'
  WHEN '🍜' THEN 'soup'
  WHEN '🍱' THEN 'utensils'
  WHEN '🍣' THEN 'utensils'
  WHEN '🍕' THEN 'pizza'
  WHEN '🍝' THEN 'utensils'
  WHEN '🍛' THEN 'utensils'
  WHEN '🍚' THEN 'utensils'
  WHEN '🥘' THEN 'utensils'
  WHEN '🍳' THEN 'utensils'
  WHEN '🥗' THEN 'utensils'
  WHEN '🍰' THEN 'cake'
  WHEN '🍦' THEN 'ice-cream'
  WHEN '🥐' THEN 'croissant'
  WHEN '🍩' THEN 'donut'
  WHEN '🍪' THEN 'cookie'
  WHEN '🍫' THEN 'cookie'
  WHEN '🍬' THEN 'candy'
  WHEN '🍓' THEN 'cherry'
  WHEN '🍎' THEN 'apple'
  WHEN '🍊' THEN 'citrus'
  WHEN '🥑' THEN 'avocado'
  WHEN '🍆' THEN 'carrot'
  WHEN '🥕' THEN 'carrot'
  WHEN '🥦' THEN 'broccoli'
  WHEN '🥩' THEN 'beef'
  WHEN '🐟' THEN 'fish'
  WHEN '🍗' THEN 'drumstick'
  WHEN '☕' THEN 'coffee'
  WHEN '🍷' THEN 'wine'
  WHEN '🍺' THEN 'beer'
  WHEN '🍵' THEN 'coffee'
  WHEN '🥤' THEN 'coffee'
  -- ── Transport ──
  WHEN '🚗' THEN 'car'
  WHEN '🚕' THEN 'car'
  WHEN '🚇' THEN 'train-front'
  WHEN '🚌' THEN 'bus'
  WHEN '🚊' THEN 'train-front'
  WHEN '🚲' THEN 'bike'
  WHEN '🛵' THEN 'bike'
  WHEN '✈️' THEN 'plane'
  WHEN '🚢' THEN 'ship'
  WHEN '🚀' THEN 'rocket'
  WHEN '🚁' THEN 'rocket'
  WHEN '🚓' THEN 'car'
  WHEN '🚑' THEN 'ambulance'
  WHEN '🚒' THEN 'truck'
  WHEN '🚜' THEN 'tractor'
  WHEN '🚂' THEN 'train-front'
  WHEN '🚆' THEN 'train-front'
  WHEN '🛺' THEN 'car'
  WHEN '🚠' THEN 'cable-car'
  WHEN '🚟' THEN 'train-front'
  -- ── Shopping ──
  WHEN '🛍️' THEN 'shopping-bag'
  WHEN '🛒' THEN 'shopping-cart'
  WHEN '👕' THEN 'shirt'
  WHEN '👗' THEN 'shirt'
  WHEN '👠' THEN 'footprints'
  WHEN '👟' THEN 'footprints'
  WHEN '👜' THEN 'shopping-bag'
  WHEN '💳' THEN 'credit-card'
  WHEN '🏷️' THEN 'tag'
  WHEN '📦' THEN 'package'
  WHEN '🎄' THEN 'gift'
  WHEN '🎃' THEN 'gift'
  WHEN '🎈' THEN 'party-popper'
  WHEN '🎊' THEN 'party-popper'
  WHEN '🎀' THEN 'gift'
  -- ── Home ──
  WHEN '🏠' THEN 'house'
  WHEN '🏡' THEN 'house'
  WHEN '🛏️' THEN 'bed-double'
  WHEN '🛋️' THEN 'sofa'
  WHEN '🚿' THEN 'shower-head'
  WHEN '🧹' THEN 'trash'
  WHEN '🧺' THEN 'shopping-cart'
  WHEN '🔌' THEN 'plug'
  WHEN '🔋' THEN 'battery-charging'
  WHEN '💡' THEN 'lightbulb'
  WHEN '🔥' THEN 'flame'
  WHEN '❄️' THEN 'snowflake'
  WHEN '📺' THEN 'tv'
  WHEN '📻' THEN 'tv'
  WHEN '🪔' THEN 'lamp'
  -- ── Health ──
  WHEN '💊' THEN 'pill'
  WHEN '🩺' THEN 'stethoscope'
  WHEN '🏥' THEN 'cross'
  WHEN '🤒' THEN 'thermometer'
  WHEN '🤧' THEN 'thermometer'
  WHEN '😷' THEN 'pill'
  WHEN '💪' THEN 'dumbbell'
  WHEN '🧘' THEN 'heart-pulse'
  WHEN '🩹' THEN 'bandage'
  WHEN '💉' THEN 'syringe'
  WHEN '🦷' THEN 'pill'
  WHEN '🧴' THEN 'droplet'
  -- ── Entertainment ──
  WHEN '🎮' THEN 'gamepad-2'
  WHEN '🕹️' THEN 'gamepad-2'
  WHEN '🎬' THEN 'film'
  WHEN '🎭' THEN 'drama'
  WHEN '🎵' THEN 'music'
  WHEN '🎶' THEN 'music'
  WHEN '🎸' THEN 'guitar'
  WHEN '🎹' THEN 'piano'
  WHEN '🎺' THEN 'music'
  WHEN '🎻' THEN 'music'
  WHEN '🎯' THEN 'target'
  WHEN '🎲' THEN 'dice-5'
  WHEN '🎳' THEN 'dice-5'
  WHEN '🎰' THEN 'dice-5'
  WHEN '🃏' THEN 'spade'
  WHEN '🎨' THEN 'palette'
  WHEN '📷' THEN 'camera'
  WHEN '🎟️' THEN 'ticket'
  WHEN '🎪' THEN 'party-popper'
  WHEN '🏟️' THEN 'party-popper'
  -- ── Education & Work ──
  WHEN '📚' THEN 'book-open'
  WHEN '✏️' THEN 'pencil'
  WHEN '📝' THEN 'clipboard-list'
  WHEN '📖' THEN 'book-open'
  WHEN '🎓' THEN 'graduation-cap'
  WHEN '🏫' THEN 'graduation-cap'
  WHEN '💼' THEN 'briefcase'
  WHEN '💻' THEN 'laptop'
  WHEN '🖥️' THEN 'monitor'
  WHEN '⌨️' THEN 'keyboard'
  WHEN '🖱️' THEN 'mouse-pointer-2'
  WHEN '📋' THEN 'clipboard-list'
  WHEN '📊' THEN 'bar-chart-3'
  WHEN '📈' THEN 'trending-up'
  WHEN '📉' THEN 'trending-down'
  WHEN '🖊️' THEN 'pen-line'
  WHEN '📌' THEN 'pin'
  WHEN '📎' THEN 'paperclip'
  WHEN '📒' THEN 'notebook'
  WHEN '🗓️' THEN 'calendar-days'
  -- ── Gifts ──
  WHEN '🎁' THEN 'gift'
  WHEN '🎉' THEN 'party-popper'
  WHEN '🧧' THEN 'hand-coins'
  WHEN '🎂' THEN 'cake'
  WHEN '💝' THEN 'heart'
  WHEN '🌹' THEN 'flower-2'
  WHEN '💐' THEN 'flower-2'
  WHEN '💌' THEN 'mail'
  WHEN '🎊' THEN 'party-popper'
  -- ── Finance ──
  WHEN '💰' THEN 'wallet'
  WHEN '💵' THEN 'banknote'
  WHEN '💴' THEN 'banknote'
  WHEN '💶' THEN 'banknote'
  WHEN '💷' THEN 'banknote'
  WHEN '🪙' THEN 'coins'
  WHEN '💸' THEN 'circle-dollar-sign'
  WHEN '🧾' THEN 'receipt-text'
  WHEN '🏦' THEN 'landmark'
  WHEN '🏧' THEN 'landmark'
  WHEN '💹' THEN 'trending-up'
  WHEN '💳' THEN 'credit-card'
  WHEN '🤑' THEN 'badge-dollar-sign'
  -- ── Pets ──
  WHEN '🐾' THEN 'paw-print'
  WHEN '🐶' THEN 'dog'
  WHEN '🐱' THEN 'cat'
  WHEN '🐰' THEN 'rabbit'
  WHEN '🐹' THEN 'rabbit'
  WHEN '🐦' THEN 'bird'
  WHEN '🐟' THEN 'fish'
  WHEN '🐢' THEN 'turtle'
  WHEN '🐈' THEN 'cat'
  WHEN '🐕' THEN 'dog'
  WHEN '🦜' THEN 'bird'
  WHEN '🐀' THEN 'rabbit'
  WHEN '🦔' THEN 'paw-print'
  -- ── Travel ──
  WHEN '✈️' THEN 'plane'
  WHEN '🏖️' THEN 'palmtree'
  WHEN '🏝️' THEN 'palmtree'
  WHEN '🗺️' THEN 'map'
  WHEN '🧳' THEN 'luggage'
  WHEN '🌅' THEN 'sunrise'
  WHEN '🌄' THEN 'sunrise'
  WHEN '🗽' THEN 'landmark'
  WHEN '🏛️' THEN 'landmark'
  WHEN '🎡' THEN 'palmtree'
  WHEN '🎢' THEN 'palmtree'
  -- ── Family ──
  WHEN '👨‍👩‍👧' THEN 'users'
  WHEN '👶' THEN 'baby'
  WHEN '👵' THEN 'users'
  WHEN '👴' THEN 'users'
  WHEN '💍' THEN 'heart-handshake'
  WHEN '🤱' THEN 'baby'
  WHEN '🧸' THEN 'baby'
  WHEN '📚' THEN 'book-open'
  WHEN '🎓' THEN 'graduation-cap'
  WHEN '🪥' THEN 'pill'
  -- ── Misc ──
  WHEN '💬' THEN 'message-circle'
  WHEN '📱' THEN 'smartphone'
  WHEN '📞' THEN 'phone'
  WHEN '🌐' THEN 'globe'
  WHEN '🔧' THEN 'wrench'
  WHEN '🔨' THEN 'hammer'
  WHEN '⚙️' THEN 'cog'
  WHEN '🧰' THEN 'wrench'
  WHEN '🪛' THEN 'screwdriver'
  WHEN '🪚' THEN 'wrench'
  WHEN '🧷' THEN 'pin'
  WHEN '🧹' THEN 'trash'
  WHEN '🪣' THEN 'trash'
  WHEN '🔔' THEN 'bell'
  WHEN '⭐' THEN 'star'
  WHEN '❤️' THEN 'heart'
  WHEN '🚫' THEN 'ban'
  WHEN '❓' THEN 'circle-help'
  WHEN '✨' THEN 'sparkles'
  WHEN '🌟' THEN 'star'
  -- ── 兜底 ──
  ELSE 'circle-help'
END;

-- 验证: 迁移后无 emoji 残留
-- SELECT id, icon FROM categories WHERE icon ~ '[^\x00-\x7F]';
-- 预期: 0 行

-- 验证: 兜底行(需人工修正)
-- SELECT id, name, icon FROM categories WHERE icon = 'circle-help';
-- 预期: 0 行(所有 emoji 均命中映射)
```

## 4. Seed 同步: `0003_categories.sql`

将 20 个内置分类的 icon 值从 emoji 改为图标名:

```sql
-- 修改前:
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES
('...', '餐饮', 'expense', '🍔', 100, true),
-- ...

-- 修改后:
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES
('...', '餐饮', 'expense', 'utensils', 100, true),
('...', '交通', 'expense', 'car', 200, true),
('...', '购物', 'expense', 'shopping-bag', 300, true),
('...', '住房', 'expense', 'house', 400, true),
('...', '水电煤', 'expense', 'lightbulb', 500, true),
('...', '通讯', 'expense', 'smartphone', 600, true),
('...', '医疗', 'expense', 'pill', 700, true),
('...', '娱乐', 'expense', 'gamepad-2', 800, true),
('...', '教育', 'expense', 'book-open', 900, true),
('...', '服饰', 'expense', 'shirt', 1000, true),
('...', '人情', 'expense', 'gift', 1100, true),
('...', '其他支出', 'expense', 'circle-dollar-sign', 1200, true),
('...', '工资', 'income', 'wallet', 100, true),
('...', '奖金', 'income', 'party-popper', 200, true),
('...', '理财收益', 'income', 'trending-up', 300, true),
('...', '兼职', 'income', 'briefcase', 400, true),
('...', '报销', 'income', 'receipt-text', 500, true),
('...', '红包', 'income', 'hand-coins', 600, true),
('...', '退款', 'income', 'undo-2', 700, true),
('...', '其他收入', 'income', 'banknote', 800, true)
ON CONFLICT (name, type) DO NOTHING;
```

**幂等性**: `ON CONFLICT DO NOTHING` 保证重跑 seed 不会覆盖已迁移的自定义分类。但内置分类的 icon 值需由迁移 SQL(0008)统一更新,seed 仅保证全新部署时内置分类直接用图标名。
