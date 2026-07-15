/**
 * Category lucide icon library (028-category-lucide-icons, T001).
 *
 * 替换 category-emojis.ts —— 从 emoji 字符迁移到 lucide-react 矢量图标名。
 * 前端(IconPicker)和后端(zod refine)导入同一源,零漂移。
 *
 * 设计:
 * - CATEGORY_ICON_MAP: 图标名(kebab-case) → lucide 组件,O(1) 查找
 * - CATEGORY_ICONS: 白名单数组(从 map keys 派生)
 * - CATEGORY_ICON_SET: O(1) 校验集
 * - CATEGORY_ICON_GROUPS: 13 域分组(picker tab 用)
 * - EMOJI_TO_ICON: emoji → 图标名映射(迁移 SQL + 过渡期回退用)
 * - isCategoryIcon: 校验函数
 */

import {
  // ── 20 built-in seed ──
  Utensils, Car, ShoppingBag, House, Lightbulb, Smartphone, Pill,
  Gamepad2, BookOpen, Shirt, Gift, CircleDollarSign, Wallet,
  PartyPopper, TrendingUp, Briefcase, ReceiptText, HandCoins,
  Undo2, Banknote,
  // ── food ──
  Coffee, Soup, Pizza, Cake, IceCream, Croissant, Donut, Cookie,
  Candy, Cherry, Apple, Citrus, Carrot, Broccoli, Beef, Fish,
  Drumstick, Wine, Beer,
  // ── transport ──
  TrainFront, Bus, Bike, Plane, Ship, Rocket, Ambulance, Truck,
  Tractor, CableCar,
  // ── shopping ──
  ShoppingCart, Footprints, Tag, Package,
  // ── home ──
  BedDouble, Sofa, ShowerHead, Plug, BatteryCharging, Flame,
  Snowflake, Tv, Lamp,
  // ── health ──
  Stethoscope, Cross, Thermometer, Dumbbell, HeartPulse, Bandage,
  Syringe, Droplet,
  // ── entertainment ──
  Film, Drama, Music, Guitar, Piano, Target, Dice5, Spade,
  Palette, Camera, Ticket,
  // ── education ──
  Pencil, ClipboardList, GraduationCap, Laptop, Monitor, Keyboard,
  MousePointer2, BarChart3, TrendingDown, PenLine, Pin, Paperclip,
  Notebook, CalendarDays,
  // ── gifts ──
  Heart, Flower2, Mail,
  // ── finance ──
  Coins, Landmark, CreditCard, BadgeDollarSign,
  // ── pets ──
  PawPrint, Dog, Cat, Rabbit, Bird, Turtle,
  // ── travel ──
  Palmtree, Map, Luggage, Sunrise,
  // ── family ──
  Users, Baby, HeartHandshake,
  // ── misc ──
  MessageCircle, Phone, Globe, Wrench, Hammer, Cog, Bell, Star,
  Ban, CircleHelp, Sparkles,
  type LucideIcon,
} from "lucide-react";

// ─── 图标名 → lucide 组件映射(O(1) 查找) ───

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  // built-in
  "utensils": Utensils,
  "car": Car,
  "shopping-bag": ShoppingBag,
  "house": House,
  "lightbulb": Lightbulb,
  "smartphone": Smartphone,
  "pill": Pill,
  "gamepad-2": Gamepad2,
  "book-open": BookOpen,
  "shirt": Shirt,
  "gift": Gift,
  "circle-dollar-sign": CircleDollarSign,
  "wallet": Wallet,
  "party-popper": PartyPopper,
  "trending-up": TrendingUp,
  "briefcase": Briefcase,
  "receipt-text": ReceiptText,
  "hand-coins": HandCoins,
  "undo-2": Undo2,
  "banknote": Banknote,
  // food
  "coffee": Coffee,
  "soup": Soup,
  "pizza": Pizza,
  "cake": Cake,
  "ice-cream": IceCream,
  "croissant": Croissant,
  "donut": Donut,
  "cookie": Cookie,
  "candy": Candy,
  "cherry": Cherry,
  "apple": Apple,
  "citrus": Citrus,
  "carrot": Carrot,
  "broccoli": Broccoli,
  "beef": Beef,
  "fish": Fish,
  "drumstick": Drumstick,
  "wine": Wine,
  "beer": Beer,
  // transport
  "train-front": TrainFront,
  "bus": Bus,
  "bike": Bike,
  "plane": Plane,
  "ship": Ship,
  "rocket": Rocket,
  "ambulance": Ambulance,
  "truck": Truck,
  "tractor": Tractor,
  "cable-car": CableCar,
  // shopping
  "shopping-cart": ShoppingCart,
  "footprints": Footprints,
  "tag": Tag,
  "package": Package,
  // home
  "bed-double": BedDouble,
  "sofa": Sofa,
  "shower-head": ShowerHead,
  "plug": Plug,
  "battery-charging": BatteryCharging,
  "flame": Flame,
  "snowflake": Snowflake,
  "tv": Tv,
  "lamp": Lamp,
  // health
  "stethoscope": Stethoscope,
  "cross": Cross,
  "thermometer": Thermometer,
  "dumbbell": Dumbbell,
  "heart-pulse": HeartPulse,
  "bandage": Bandage,
  "syringe": Syringe,
  "droplet": Droplet,
  // entertainment
  "film": Film,
  "drama": Drama,
  "music": Music,
  "guitar": Guitar,
  "piano": Piano,
  "target": Target,
  "dice-5": Dice5,
  "spade": Spade,
  "palette": Palette,
  "camera": Camera,
  "ticket": Ticket,
  // education
  "pencil": Pencil,
  "clipboard-list": ClipboardList,
  "graduation-cap": GraduationCap,
  "laptop": Laptop,
  "monitor": Monitor,
  "keyboard": Keyboard,
  "mouse-pointer-2": MousePointer2,
  "bar-chart-3": BarChart3,
  "trending-down": TrendingDown,
  "pen-line": PenLine,
  "pin": Pin,
  "paperclip": Paperclip,
  "notebook": Notebook,
  "calendar-days": CalendarDays,
  // gifts
  "heart": Heart,
  "flower-2": Flower2,
  "mail": Mail,
  // finance
  "coins": Coins,
  "landmark": Landmark,
  "credit-card": CreditCard,
  "badge-dollar-sign": BadgeDollarSign,
  // pets
  "paw-print": PawPrint,
  "dog": Dog,
  "cat": Cat,
  "rabbit": Rabbit,
  "bird": Bird,
  "turtle": Turtle,
  // travel
  "palmtree": Palmtree,
  "map": Map,
  "luggage": Luggage,
  "sunrise": Sunrise,
  // family
  "users": Users,
  "baby": Baby,
  "heart-handshake": HeartHandshake,
  // misc
  "message-circle": MessageCircle,
  "phone": Phone,
  "globe": Globe,
  "wrench": Wrench,
  "hammer": Hammer,
  "cog": Cog,
  "bell": Bell,
  "star": Star,
  "ban": Ban,
  "circle-help": CircleHelp,
  "sparkles": Sparkles,
};

// ─── 白名单(从 map keys 派生,零漂移) ───

export const CATEGORY_ICONS = Object.keys(CATEGORY_ICON_MAP) as readonly string[];

export const CATEGORY_ICON_SET: ReadonlySet<string> = new Set<string>(CATEGORY_ICONS);

export type CategoryIconName = (typeof CATEGORY_ICONS)[number];

// ─── 按域分组(picker tab 用,沿用 13 组) ───

export const CATEGORY_ICON_GROUPS = [
  { id: "food", label: "食物", icons: ["utensils", "coffee", "soup", "pizza", "cake", "ice-cream", "croissant", "donut", "cookie", "candy", "cherry", "apple", "citrus", "carrot", "broccoli", "beef", "fish", "drumstick", "wine", "beer"] },
  { id: "transport", label: "交通", icons: ["car", "train-front", "bus", "bike", "plane", "ship", "rocket", "ambulance", "truck", "tractor", "cable-car"] },
  { id: "shopping", label: "购物", icons: ["shopping-bag", "shopping-cart", "shirt", "footprints", "tag", "package"] },
  { id: "home", label: "家居", icons: ["house", "bed-double", "sofa", "shower-head", "plug", "battery-charging", "lightbulb", "flame", "snowflake", "tv", "lamp"] },
  { id: "health", label: "医疗", icons: ["pill", "stethoscope", "cross", "thermometer", "dumbbell", "heart-pulse", "bandage", "syringe", "droplet"] },
  { id: "entertainment", label: "娱乐", icons: ["gamepad-2", "film", "drama", "music", "guitar", "piano", "target", "dice-5", "spade", "palette", "camera", "ticket"] },
  { id: "education", label: "教育", icons: ["book-open", "pencil", "clipboard-list", "graduation-cap", "laptop", "monitor", "keyboard", "mouse-pointer-2", "bar-chart-3", "trending-up", "trending-down", "pen-line", "pin", "paperclip", "notebook", "calendar-days", "briefcase"] },
  { id: "gifts", label: "人情", icons: ["gift", "party-popper", "hand-coins", "cake", "heart", "flower-2", "mail"] },
  { id: "finance", label: "财务", icons: ["wallet", "banknote", "circle-dollar-sign", "receipt-text", "landmark", "credit-card", "coins", "badge-dollar-sign", "trending-up"] },
  { id: "pets", label: "宠物", icons: ["paw-print", "dog", "cat", "rabbit", "bird", "fish", "turtle"] },
  { id: "travel", label: "旅行", icons: ["plane", "palmtree", "map", "luggage", "sunrise"] },
  { id: "family", label: "家庭", icons: ["users", "baby", "heart-handshake"] },
  { id: "misc", label: "其他", icons: ["smartphone", "message-circle", "phone", "globe", "wrench", "hammer", "cog", "bell", "star", "heart", "ban", "circle-help", "sparkles", "undo-2"] },
] as const;

export type IconGroup = (typeof CATEGORY_ICON_GROUPS)[number];

// ─── emoji → 图标名映射(迁移 SQL + 过渡期回退用) ───

export const EMOJI_TO_ICON: Record<string, string> = {
  // food
  "🍔": "utensils", "🍜": "soup", "🍱": "utensils", "🍣": "utensils",
  "🍕": "pizza", "🍝": "utensils", "🍛": "utensils", "🍚": "utensils",
  "🥘": "utensils", "🍳": "utensils", "🥗": "utensils", "🍰": "cake",
  "🍦": "ice-cream", "🥐": "croissant", "🍩": "donut", "🍪": "cookie",
  "🍫": "cookie", "🍬": "candy", "🍓": "cherry", "🍎": "apple",
  "🍊": "citrus", "🥑": "carrot", "🍆": "carrot", "🥕": "carrot",
  "🥦": "broccoli", "🥩": "beef", "🐟": "fish", "🍗": "drumstick",
  "☕": "coffee", "🍷": "wine", "🍺": "beer", "🍵": "coffee", "🥤": "coffee",
  // transport
  "🚗": "car", "🚕": "car", "🚇": "train-front", "🚌": "bus",
  "🚊": "train-front", "🚲": "bike", "🛵": "bike", "✈️": "plane",
  "🚢": "ship", "🚀": "rocket", "🚁": "rocket", "🚓": "car",
  "🚑": "ambulance", "🚒": "truck", "🚜": "tractor", "🚂": "train-front",
  "🚆": "train-front", "🛺": "car", "🚠": "cable-car", "🚟": "train-front",
  // shopping
  "🛍️": "shopping-bag", "🛒": "shopping-cart", "👕": "shirt",
  "👗": "shirt", "👠": "footprints", "👟": "footprints",
  "👜": "shopping-bag", "💳": "credit-card", "🏷️": "tag",
  "📦": "package", "🎄": "gift", "🎃": "gift", "🎈": "party-popper",
  "🎊": "party-popper", "🎀": "gift",
  // home
  "🏠": "house", "🏡": "house", "🛏️": "bed-double", "🛋️": "sofa",
  "🚿": "shower-head", "🧹": "wrench", "🧺": "shopping-cart",
  "🔌": "plug", "🔋": "battery-charging", "💡": "lightbulb",
  "🔥": "flame", "❄️": "snowflake", "📺": "tv", "📻": "tv", "🪔": "lamp",
  // health
  "💊": "pill", "🩺": "stethoscope", "🏥": "cross", "🤒": "thermometer",
  "🤧": "thermometer", "😷": "pill", "💪": "dumbbell", "🧘": "heart-pulse",
  "🩹": "bandage", "💉": "syringe", "🦷": "pill", "🧴": "droplet",
  // entertainment
  "🎮": "gamepad-2", "🕹️": "gamepad-2", "🎬": "film", "🎭": "drama",
  "🎵": "music", "🎶": "music", "🎸": "guitar", "🎹": "piano",
  "🎺": "music", "🎻": "music", "🎯": "target", "🎲": "dice-5",
  "🎳": "dice-5", "🎰": "dice-5", "🃏": "spade", "🎨": "palette",
  "📷": "camera", "🎟️": "ticket", "🎪": "party-popper", "🏟️": "party-popper",
  // education
  "📚": "book-open", "✏️": "pencil", "📝": "clipboard-list",
  "📖": "book-open", "🎓": "graduation-cap", "🏫": "graduation-cap",
  "💼": "briefcase", "💻": "laptop", "🖥️": "monitor", "⌨️": "keyboard",
  "🖱️": "mouse-pointer-2", "📋": "clipboard-list", "📊": "bar-chart-3",
  "📈": "trending-up", "📉": "trending-down", "🖊️": "pen-line",
  "📌": "pin", "📎": "paperclip", "📒": "notebook", "🗓️": "calendar-days",
  // gifts
  "🎁": "gift", "🎉": "party-popper", "🧧": "hand-coins", "🎂": "cake",
  "💝": "heart", "🌹": "flower-2", "💐": "flower-2", "💌": "mail",
  // finance
  "💰": "wallet", "💵": "banknote", "💴": "banknote", "💶": "banknote",
  "💷": "banknote", "🪙": "coins", "💸": "circle-dollar-sign",
  "🧾": "receipt-text", "🏦": "landmark", "🏧": "landmark",
  "💹": "trending-up", "🤑": "badge-dollar-sign",
  // pets
  "🐾": "paw-print", "🐶": "dog", "🐱": "cat", "🐰": "rabbit",
  "🐹": "rabbit", "🐦": "bird", "🐢": "turtle", "🐈": "cat",
  "🐕": "dog", "🦜": "bird", "🐀": "rabbit", "🦔": "paw-print",
  // travel
  "🏖️": "palmtree", "🏝️": "palmtree", "🗺️": "map", "🧳": "luggage",
  "🌅": "sunrise", "🌄": "sunrise", "🗽": "landmark", "🏛️": "landmark",
  "🎡": "palmtree", "🎢": "palmtree",
  // family
  "👨‍👩‍👧": "users", "👶": "baby", "👵": "users", "👴": "users",
  "💍": "heart-handshake", "🤱": "baby", "🧸": "baby", "🪥": "pill",
  // misc
  "💬": "message-circle", "📱": "smartphone", "📞": "phone",
  "🌐": "globe", "🔧": "wrench", "🔨": "hammer", "⚙️": "cog",
  "🧰": "wrench", "🪛": "wrench", "🪚": "wrench", "🧷": "pin",
  "🪣": "wrench", "🔔": "bell", "⭐": "star", "❤️": "heart",
  "🚫": "ban", "❓": "circle-help", "✨": "sparkles", "🌟": "star",
  "↩️": "undo-2",
};

// ─── 校验函数 ───

export function isCategoryIcon(value: string): boolean {
  return typeof value === "string" && CATEGORY_ICON_SET.has(value);
}
