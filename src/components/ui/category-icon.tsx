/**
 * CategoryIcon — 圆形彩色背景 + emoji 居中的分类标识。
 *
 * 替代"裸 emoji"渲染:用 seed-based hash 给每个分类稳定分配一种颜色,
 * 圆形半透明背景(20% 调色)让 emoji 视觉锚定更强,接近 MOVO finance
 * 的分类图标语言(过滤商业 banking 元素)。
 *
 * 与 reports/palette.ts + lib/category-palette.ts 同源,保证 dashboard /
 * transactions / reports 三处看到的"分类 X"颜色一致。
 *
 * 纯展示组件,无 forwardRef / 无交互。
 */

import { categoryColor } from "@/lib/category-palette";

export function CategoryIcon({
  emoji,
  /** 用于稳定选色的 seed(分类 id 优先,回退 name)。 */
  seed,
  size = 36,
}: {
  emoji: string | null | undefined;
  seed: string;
  size?: number;
}) {
  const color = categoryColor(seed || "?");
  const glyph = emoji ?? "?";
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        // color-mix:oklch 把品牌色混 20% 到透明,得到柔和的彩色背景。
        // 现代浏览器(Chrome 111+/Safari 16.2+/FF 113+)支持;旧浏览器
        // 回退到透明背景,emoji 仍可读。
        backgroundColor: `color-mix(in oklch, ${color} 20%, transparent)`,
      }}
    >
      <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{glyph}</span>
    </span>
  );
}
