# Research: 分类图标 emoji → lucide-react 映射

**Feature**: 028-category-lucide-icons | **Date**: 2026-07-15

## 1. lucide-react 版本验证

**安装版本**: `1.23.0`(`package.json` 声明 `^1.23.0`)

**验证方法**: `node -e "const icons = require('lucide-react'); icons['Utensils']"` 等

**结论**: 183+ 图标名已验证可用,覆盖 13 域全部需求。少量图标名需调整(lucide v1.x 与 v0.x 命名差异),详见 §3 替代表。

## 2. 20 内置 seed emoji → lucide 图标名映射

| 分类名 | emoji | lucide 图标名 | PascalCase 导出 | 域 |
|--------|-------|--------------|-----------------|-----|
| 餐饮 | 🍔 | `utensils` | `Utensils` | food |
| 交通 | 🚗 | `car` | `Car` | transport |
| 购物 | 🛍️ | `shopping-bag` | `ShoppingBag` | shopping |
| 住房 | 🏠 | `house` | `House` | home |
| 水电煤 | 💡 | `lightbulb` | `Lightbulb` | home |
| 通讯 | 📱 | `smartphone` | `Smartphone` | misc |
| 医疗 | 💊 | `pill` | `Pill` | health |
| 娱乐 | 🎮 | `gamepad-2` | `Gamepad2` | entertainment |
| 教育 | 📚 | `book-open` | `BookOpen` | education |
| 服饰 | 👕 | `shirt` | `Shirt` | shopping |
| 人情 | 🎁 | `gift` | `Gift` | gifts |
| 其他支出 | 💸 | `circle-dollar-sign` | `CircleDollarSign` | finance |
| 工资 | 💰 | `wallet` | `Wallet` | finance |
| 奖金 | 🎉 | `party-popper` | `PartyPopper` | gifts |
| 理财收益 | 📈 | `trending-up` | `TrendingUp` | finance |
| 兼职 | 💼 | `briefcase` | `Briefcase` | education |
| 报销 | 🧾 | `receipt-text` | `ReceiptText` | finance |
| 红包 | 🧧 | `hand-coins` | `HandCoins` | gifts |
| 退款 | ↩️ | `undo-2` | `Undo2` | misc |
| 其他收入 | 💵 | `banknote` | `Banknote` | finance |

## 3. ~120 全量 emoji → lucide 图标名映射策略

### 3.1 域分组(沿用 024 的 13 组)

| 组 ID | 中文标签 | emoji 数 | lucide 图标数 | 示例映射 |
|-------|---------|---------|-------------|---------|
| food | 食物 | 33 | ~25 | 🍔→utensils, 🍜→soup, 🍕→pizza, ☕→coffee, 🍺→beer, 🍰→cake |
| transport | 交通 | 20 | ~15 | 🚗→car, 🚌→bus, 🚲→bike, ✈️→plane, 🚇→train-front, 🛵→bike |
| shopping | 购物 | 15 | ~10 | 🛍️→shopping-bag, 🛒→shopping-cart, 👗→shirt, 👟→footprints |
| home | 家居 | 15 | ~12 | 🏠→house, 🛏️→bed-double, 🛋️→sofa, 💡→lightbulb, 🔥→flame |
| health | 医疗 | 12 | ~8 | 💊→pill, 🏥→cross, 🩺→stethoscope, 💪→dumbbell, 💉→syringe |
| entertainment | 娱乐 | 20 | ~15 | 🎮→gamepad-2, 🎬→film, 🎵→music, 🎸→guitar, 📷→camera |
| education | 教育 | 20 | ~15 | 📚→book-open, ✏️→pencil, 💻→laptop, 📊→bar-chart-3, 🎓→graduation-cap |
| gifts | 人情 | 10 | ~8 | 🎁→gift, 🎉→party-popper, 🧧→hand-coins, 🎂→cake, 💝→heart |
| finance | 财务 | 13 | ~10 | 💰→wallet, 💵→banknote, 🏦→landmark, 💳→credit-card, 🧾→receipt-text |
| pets | 宠物 | 13 | ~8 | 🐶→dog, 🐱→cat, 🐰→rabbit, 🐦→bird, 🐟→fish, 🐾→paw-print |
| travel | 旅行 | 12 | ~8 | ✈️→plane, 🏖️→palmtree, 🗺️→map, 🧳→luggage, 🌅→sunrise |
| family | 家庭 | 10 | ~6 | 👶→baby, 👴→users, 💍→heart-handshake, 🧸→baby(复用) |
| misc | 其他 | 20 | ~12 | 📱→smartphone, 🔧→wrench, ⭐→star, ❤️→heart, ❓→circle-help |

### 3.2 映射原则

1. **语义优先**: emoji 的语义 → 最接近的 lucide 图标(🍔 食物 → `utensils` 餐具,而非 `beef` 独立食物)
2. **去重合并**: ~120 emoji 中约 30 个语义重叠(如 🚗🚕🚓 都 → `car`),映射后图标名 ~80 个,减少选择器认知负担
3. **兜底图标**: 无法语义对应的 emoji → `circle-help`(❓);迁移日志记录
4. **域名命名**: lucide 图标名用 kebab-case(`gamepad-2` 非 `gamepad2`),与 lucide-react 导出的 `Gamepad2` 对应

### 3.3 验证缺失图标名的替代

| 原拟名 | 状态 | 替代 |
|--------|------|------|
| `MugSoda` | ❌ 不存在 | → `Coffee`(☕ 统一) |
| `Teapot` | ❌ 不存在 | → `Coffee`(🍵 统一) |
| `Ferry` | ❌ 不存在 | → `Ship`(🚢 统一) |
| `Tooth` | ❌ 不存在 | → `Pill`(医疗统一切换) |
| `PumpBottle` | ❌ 不存在 | → `Droplet`(🧴 统一) |
| `Trumpet`/`Violin` | ❌ 不存在 | → `Music`(乐器统一) |
| `Bowling` | ❌ 不存在 | → `Dice5`(🎲 统一) |
| `Hamster`/`Parrot`/`Hedgehog` | ❌ 不存在 | → `Rabbit`/`Bird`/`PawPrint`(近义替代) |
| `Island`/`Statue` | ❌ 不存在 | → `Palmtree`/`Landmark`(近义替代) |
| `OldMan`/`OldWoman` | ❌ 不存在 | → `Users`(人物统一) |
| `Ring` | ❌ 不存在 | → `HeartHandshake`(💍 统一) |
| `TeddyBear`/`Toothbrush` | ❌ 不存在 | → `Baby`/`Pill`(近义替代) |

## 4. CategoryIcon 组件设计

```tsx
// src/components/category/category-icon.tsx
import { type LucideIcon } from "lucide-react";
import { CATEGORY_ICON_MAP } from "@/lib/constants/category-icons";

const FALLBACK_ICON: LucideIcon = /* CircleHelp */;

export function CategoryIcon({
  name,
  size = 20,
  className,
  "aria-label": ariaLabel,
}: {
  name: string;
  size?: number;
  className?: string;
  "aria-label"?: string;
}) {
  // 1. 尝试图标名映射(矢量)
  const IconComponent = CATEGORY_ICON_MAP[name];
  if (IconComponent) {
    return (
      <IconComponent
        size={size}
        className={className}
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
      />
    );
  }
  // 2. 兜底:未知名 → 默认图标(不抛错、不空白)
  // 注:过渡期 emoji 值已在映射表中映射(见 category-icons.ts EMOJI_TO_ICON),
  //     非白名单脏数据走兜底。
  const Fallback = FALLBACK_ICON;
  return <Fallback size={size} className={className} aria-hidden />;
}
```

**关键设计点**:
- `CATEGORY_ICON_MAP`: `{ [iconName: string]: LucideIcon }` — 图标名 → lucide 组件映射,在常量文件中构建
- emoji 回退:不在 map 中的值(旧 emoji)渲染兜底图标;过渡期数据迁移后无 emoji 残留
- `aria-hidden`: 装饰性图标默认隐藏;语义性图标传 `aria-label`
- `size`: 默认 20px,各调用点按需传(列表项 20、dashboard 18、小尺寸 14)

## 5. HeroUI v3 Popover/Tabs API 确认

024 已完成 shadcn→HeroUI v3 适配,`EmojiPicker` 使用:
- `Popover` / `PopoverContent` / `PopoverTrigger`(shadcn 适配层)
- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`(shadcn 适配层)

`IconPicker` 沿用同一骨架,仅换网格内容(emoji 字符 → `<CategoryIcon>`)。**无需查 HeroUI v3 原生 Popover/Tabs**(024 已验证可用),但实现时仍按宪章原则七先 `/heroui-react` skill 确认。

## 6. 迁移 SQL 兜底策略

```sql
-- 0008_category_icons.sql
UPDATE categories SET icon = CASE icon
  WHEN '🍔' THEN 'utensils'
  WHEN '🚗' THEN 'car'
  -- ... 全量 ~120 条 ...
  ELSE 'circle-help'  -- 兜底:非白名单脏数据
END;
```

**兜底日志**: 迁移后执行 `SELECT id, icon FROM categories WHERE icon = 'circle-help'` 查看兜底行,人工修正。

**down 路径**: 反向 CASE(图标名 → emoji),满足宪章"迁移验证 down 路径可回滚"。
