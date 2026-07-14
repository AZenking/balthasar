/**
 * 共享调色板(026-switch 第一期 5:环形图明细同色标记)。
 *
 * CategoryDonut 的每段 Cell 与 CategoryBreakdownCard 的明细列表行前 dot
 * 共用同一调色板,保证图例与数据一一对应(否则用户无法把"占比 35% 的分类"
 * 对应到环形图哪一段)。
 *
 * 8 色,色相分布均匀,色盲友好度尚可。索引大于 8 时循环回退(理论上单个
 * 目标月不会超过 8 个分类,但循环保护防御性)。
 */
export const CATEGORY_PALETTE = [
  "#C79032", // 琥珀(主色)
  "#3B9B74", // 绿(收入色,此处作次色)
  "#D76555", // 红(支出色)
  "#5B8DEF", // 蓝
  "#9B6BBF", // 紫
  "#E0A458", // 浅琥珀
  "#4AA8A8", // 青
  "#B07B5E", // 棕
];

/** 取调色板第 i 色(循环)。 */
export function categoryColor(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}
