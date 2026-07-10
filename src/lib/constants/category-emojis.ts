/**
 * Category emoji library (018-custom-category, T001).
 *
 * Per research.md D3 + spec Clarifications Q3: single shared constant file
 * for both built-in (003) and custom (018) categories. Frontend (icon
 * picker) and backend (zod refine) import the same source — no drift.
 *
 * Covers all 20 icons used by 003 seed (see 0003_categories.sql) + ~100
 * additional for user customization. Total ~120 emojis grouped by domain.
 *
 * Adding/removing emojis here is a backward-compatible change — existing
 * transactions still reference categoryId, not icon directly. But removing
 * an icon already used by a custom category requires a migration to update
 * the row's icon field first.
 */

// ─── Food & Drink ───
const FOOD = [
  "🍔", "🍜", "🍱", "🍣", "🍕", "🍝", "🍛", "🍚", "🥘", "🍳",
  "🥗", "🍰", "🍦", "🥐", "🍩", "🍪", "🍫", "🍬", "🍓", "🍎",
  "🍊", "🥑", "🍆", "🥕", "🥦", "🥩", "🐟", "🍗", "☕", "🍷",
  "🍺", "🍵", "🥤",
] as const;

// ─── Transport ───
const TRANSPORT = [
  "🚗", "🚕", "🚇", "🚌", "🚊", "🚲", "🛵", "✈️", "🚢", "🚀",
  "🚁", "🚓", "🚑", "🚒", "🚜", "🚂", "🚆", "🛺", "🚠", "🚟",
] as const;

// ─── Shopping ───
const SHOPPING = [
  "🛍️", "🛒", "👕", "👗", "👠", "👟", "👜", "💳", "🏷️", "📦",
  "🎄", "🎃", "🎈", "🎊", "🎀",
] as const;

// ─── Home & Utilities ───
const HOME = [
  "🏠", "🏡", "🛏️", "🛋️", "🚿", "🧹", "🧺", "🔌", "🔋", "💡",
  "🔥", "❄️", "📺", "📻", "🪔",
] as const;

// ─── Health ───
const HEALTH = [
  "💊", "🩺", "🏥", "🤒", "🤧", "😷", "💪", "🧘", "🩹", "💉",
  "🦷", "🧴",
] as const;

// ─── Entertainment ───
const ENTERTAINMENT = [
  "🎮", "🕹️", "🎬", "🎭", "🎵", "🎶", "🎸", "🎹", "🎺", "🎻",
  "🎯", "🎲", "🎳", "🎰", "🃏", "🎨", "📷", "🎟️", "🎪", "🏟️",
] as const;

// ─── Education & Work ───
const EDUCATION_WORK = [
  "📚", "✏️", "📝", "📖", "🎓", "🏫", "💼", "💻", "🖥️", "⌨️",
  "🖱️", "📋", "📊", "📈", "📉", "🖊️", "📌", "📎", "📒", "🗓️",
] as const;

// ─── Gifts & Red Packets ───
const GIFTS = [
  "🎁", "🎉", "🧧", "🎂", "💝", "🌹", "💐", "🛍️", "💌", "🎊",
] as const;

// ─── Income & Finance ───
const FINANCE = [
  "💰", "💵", "💴", "💶", "💷", "🪙", "💸", "🧾", "🏦", "🏧",
  "💹", "💳", "🤑",
] as const;

// ─── Pets & Hobbies ───
const PETS = [
  "🐾", "🐶", "🐱", "🐰", "🐹", "🐦", "🐟", "🐢", "🐈", "🐕",
  "🦜", "🐀", "🦔",
] as const;

// ─── Travel & Leisure ───
const TRAVEL = [
  "✈️", "🏖️", "🏝️", "🗺️", "🧳", "🌅", "🌄", "🗽", "🏛️", "🎡",
  "🎢", "🌅",
] as const;

// ─── Family & Care ───
const FAMILY = [
  "👨‍👩‍👧", "👶", "👵", "👴", "💍", "🤱", "🧸", "📚", "🎓", "🪥",
] as const;

// ─── Misc / Catch-all ───
const MISC = [
  "💬", "📱", "📞", "🌐", "🔧", "🔨", "⚙️", "🧰", "🪛", "🪚",
  "🧷", "🧹", "🪣", "🔔", "⭐", "❤️", "🚫", "❓", "✨", "🌟",
] as const;

export const CATEGORY_EMOJIS = [
  ...FOOD,
  ...TRANSPORT,
  ...SHOPPING,
  ...HOME,
  ...HEALTH,
  ...ENTERTAINMENT,
  ...EDUCATION_WORK,
  ...GIFTS,
  ...FINANCE,
  ...PETS,
  ...TRAVEL,
  ...FAMILY,
  ...MISC,
] as const;

export type CategoryEmoji = (typeof CATEGORY_EMOJIS)[number];

/**
 * Emoji groups for picker tabs (023-category-ui T004).
 * Each group maps to a tab in the EmojiPicker popover.
 * Order = tab order (食物 first, 其他 last).
 */
export const CATEGORY_EMOJI_GROUPS = [
  { id: "food", label: "食物", emojis: [...FOOD] },
  { id: "transport", label: "交通", emojis: [...TRANSPORT] },
  { id: "shopping", label: "购物", emojis: [...SHOPPING] },
  { id: "home", label: "家居", emojis: [...HOME] },
  { id: "health", label: "医疗", emojis: [...HEALTH] },
  { id: "entertainment", label: "娱乐", emojis: [...ENTERTAINMENT] },
  { id: "education", label: "教育", emojis: [...EDUCATION_WORK] },
  { id: "gifts", label: "人情", emojis: [...GIFTS] },
  { id: "finance", label: "财务", emojis: [...FINANCE] },
  { id: "pets", label: "宠物", emojis: [...PETS] },
  { id: "travel", label: "旅行", emojis: [...TRAVEL] },
  { id: "family", label: "家庭", emojis: [...FAMILY] },
  { id: "misc", label: "其他", emojis: [...MISC] },
] as const;

export type EmojiGroup = (typeof CATEGORY_EMOJI_GROUPS)[number];

/**
 * O(1) lookup set for validation. Built once at module load.
 *
 * Usage:
 *   import { CATEGORY_EMOJI_SET } from "@/lib/constants/category-emojis";
 *   if (!CATEGORY_EMOJI_SET.has(value)) throw new Error("...");
 */
export const CATEGORY_EMOJI_SET: ReadonlySet<string> = new Set<string>(
  CATEGORY_EMOJIS
);
