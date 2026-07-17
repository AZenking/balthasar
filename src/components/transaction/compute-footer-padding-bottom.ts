/**
 * computeFooterPaddingBottom — 029-mobile-keyboard-layout US1 纯函数。
 *
 * TransactionForm embedded 模式根 div 的 paddingBottom 计算。
 *
 * spec FR-002:保存按钮在键盘弹起时始终可达,且与键盘保持 16px 视觉间距。
 * safe-area-inset-bottom 由 CSS env() 处理(96d470f viewport-fit=cover 已解锁),
 * 此函数只算"键盘高度 + 按钮间距"部分;调用方用 max(env(safe-area-inset-bottom), <返回值>) 兜底。
 */

/** 保存按钮与键盘上沿的视觉间距(像素)。 */
export const SUBMIT_BUTTON_BOTTOM_GAP_PX = 16;

/**
 * 计算表单根 div 的 paddingBottom(像素)。
 *
 * @param keyboardHeight - useVisualViewport 返回的 keyboardHeight;负数视为 0(旋转边界)。
 * @returns paddingBottom 像素值
 */
export function computeFooterPaddingBottom(keyboardHeight: number): number {
  const clampedKeyboard = Math.max(0, keyboardHeight);
  return clampedKeyboard + SUBMIT_BUTTON_BOTTOM_GAP_PX;
}
