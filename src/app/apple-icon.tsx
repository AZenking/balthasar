import { renderIcon } from "./icon";

/**
 * Apple touch icon generator (Next.js file convention → `/apple-icon`,
 * auto-injected `<link rel="apple-touch-icon" sizes="180x180">`).
 *
 * Visual matches `icon.tsx`: amber `#C79032` square + white lucide Wallet
 * glyph. Apple applies its own squircle mask, so no border-radius. Fixed
 * 180×180 per Apple's spec.
 */
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderIcon({ size: 180, glyphScale: 0.6 });
}
