/**
 * 分类色编码(seed-based stable hash → palette index)。
 *
 * 用于圆形 category icon:同一个分类(按 id 或 name 作 seed)始终拿到
 * 同一种颜色,跨页面/跨刷新稳定,不受列表顺序影响。
 *
 * 与 src/components/reports/palette.ts 的区别:
 * - reports/palette.ts:index-based(顺序循环),环形图段与明细列表行
 *   按"出现顺序"同色配对,依赖列表 index 稳定。
 * - 本文件:seed-based(字符串 hash),不依赖顺序,用于"单分类独立
 *   呈色"场景(圆形 icon、单分类 tag)。
 *
 * 调色板与 reports/palette.ts 同源(8 色一致),保证视觉统一。
 */

export const CATEGORY_PALETTE = [
  "#C79032", // 琥珀
  "#3B9B74", // 绿
  "#D76555", // 红
  "#5B8DEF", // 蓝
  "#9B6BBF", // 紫
  "#E0A458", // 浅琥珀
  "#4AA8A8", // 青
  "#B07B5E", // 棕
] as const;

/**
 * 基于字符串 seed(分类 id 或 name)生成稳定 hash → 选 PALETTE 索引。
 *
 * 同一 seed 永远返回同一颜色;不同 seed 尽量分散到不同索引(simple
 * polynomial rolling hash 对短字符串分布已足够,无需 cryptographic hash)。
 */
export function categoryColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}
